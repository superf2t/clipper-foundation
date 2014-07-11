import datetime
import re

from dateutil import parser as date_parser
from dateutil import tz
from flask import url_for

import data
from database import user
import clip_logic
import enums
import geocode
import geometry
import google_places
import kml_import
import mailer
import sample_sites
from scraping import trip_plan_creator
import serializable
import service
import utils

Operator = enums.enum('ADD', 'EDIT', 'DELETE')

CommonError = enums.enum(
    NO_CREDENTIALS=enums.enumdata(message=None),
    NOT_AUTHORIZED_FOR_OPERATION=enums.enumdata(message='The user is not authorized to perform this action'),
    MISSING_FIELD=enums.enumdata(message='A required field is missing'),
    NOT_LOGGED_IN=enums.enumdata(message='You are required to be logged in to perform this operation'),
    OBJECT_ALREADY_REFERENCED_IN_OPERATION=enums.enumdata(message='This object was already referenced in a previous operation'))

class OperationData(object):
    def __init__(self, operation, field_path_prefix='', index=None):
        self.operation = operation
        self.field_path_prefix = field_path_prefix
        self.index = index
        self.result = None

    def field_path(self, field_name):
        if self.index is not None:
            return '%s[%d].%s' % (self.field_path_prefix, self.index, field_name)
        return '%s.%s' % (self.field_path_prefix, field_name)

    def missingfield(self, field_name):
        return service.ServiceError.from_enum(CommonError.MISSING_FIELD, self.field_path(field_name))

    def newerror(self, error_enum, message=None, field_name=None):
        field_path = self.field_path(field_name) if field_name else None
        return service.ServiceError(error_enum.name, message, field_path)

    @classmethod
    def filter_by_operator(cls, op_datas, operator):
        return [op for op in op_datas if op.operation.operator == operator.name]

    @classmethod
    def from_input(cls, operations, field_path_prefix=''):
        return [OperationData(op, field_path_prefix=field_path_prefix, index=i) for i, op in enumerate(operations)]

def decorate_with_trip_plans(trip_plan_id_attr_name, ops):
    trip_plan_ids = set(getattr(op.operation, trip_plan_id_attr_name) for op in ops)
    trip_plans = data.load_trip_plans_by_ids(trip_plan_ids)
    trip_plans_by_id = utils.dict_from_attrs(trip_plans, 'trip_plan_id')
    for op in ops:
        op.trip_plan = trip_plans_by_id.get(getattr(op.operation, trip_plan_id_attr_name))
    return trip_plans


EntityServiceError = enums.enum('NO_TRIP_PLAN_FOUND', 'DUPLICATE_POSITIONS', 'UNKNOWN_SITE')

class EntityGetRequest(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id', 'if_modified_after')

    def __init__(self, trip_plan_id=None, if_modified_after=None):
        self.trip_plan_id = trip_plan_id
        self.if_modified_after = if_modified_after

    def if_modified_after_as_datetime(self):
        if not self.if_modified_after:
            return None
        return date_parser.parse(self.if_modified_after)

class EntityGetResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('entities', data.Entity),
        'response_summary',
        'last_modified'))

    ResponseSummary = enums.enum('NO_CHANGES_SINCE_LAST_MODIFIED')

    def __init__(self, entities=(), response_summary=None, last_modified=None, **kwargs):
        super(EntityGetResponse, self).__init__(**kwargs)
        self.entities = entities
        self.response_summary = response_summary
        self.last_modified = last_modified

class EntityOperation(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('operator', 'trip_plan_id', serializable.objf('entity', data.Entity))

    def __init__(self, operator=None, trip_plan_id=None, entity=None):
        self.operator = operator
        self.trip_plan_id = trip_plan_id
        self.entity = entity

class EntityMutateRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields(serializable.objlistf('operations', EntityOperation))

    def __init__(self, operations=()):
        self.operations = operations

    def trip_plan_ids(self):
        return set(operation.trip_plan_id for operation in self.operations)

class EntityMutateResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('entities', data.Entity), 'last_modified'))

    def __init__(self, entities=(), last_modified=None, **kwargs):
        super(EntityMutateResponse, self).__init__(**kwargs)
        self.entities = entities
        self.last_modified = last_modified

class EntityCommentOperation(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('operator', 'trip_plan_id', serializable.objf('comment', data.Comment))

    def __init__(self, operator=None, trip_plan_id=None, comment=None):
        self.operator = operator
        self.trip_plan_id = trip_plan_id
        self.comment = comment

class EntityMutateCommentRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields(serializable.objlistf('operations', EntityCommentOperation))

    def __init__(self, operations=None):
        self.operations = operations

    def trip_plan_ids(self):
        return set(operation.trip_plan_id for operation in self.operations) 

class EntityMutateCommentResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('comments', data.Comment), 'last_modified'))

    def __init__(self, comments=(), last_modified=None, **kwargs):
        super(EntityMutateCommentResponse, self).__init__(**kwargs)
        self.comments = comments
        self.last_modified = last_modified

class GooglePlaceToEntityRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('reference')

    def __init__(self, reference=None):
        self.reference = reference

class UrlToEntitiesRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('url')

    def __init__(self, url=None):
        self.url = url

class PageSourceToEntityRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('url', 'page_source')

    def __init__(self, url=None, page_source=None):
        self.url = url
        self.page_source = page_source

class GoogleTextSearchToEntitiesRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('query', serializable.objf('latlng', data.LatLng),
        'max_results')

    def __init__(self, query=None, latlng=None, max_results=None):
        self.query = query
        self.latlng = latlng
        self.max_results = max_results

class SiteSearchToEntitiesRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('site_host', 'location_name',
        serializable.objf('location_latlng', data.LatLng), 'query', 'max_results')

    def __init__(self, site_host=None, location_name=None, location_latlng=None,
            query=None, max_results=None):
        self.site_host = site_host
        self.location_name = location_name
        self.location_latlng = location_latlng
        self.query = query
        self.max_results = max_results

class GenericEntityResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objf('entity', data.Entity)))

    def __init__(self, entity=None, **kwargs):
        super(GenericEntityResponse, self).__init__(**kwargs)
        self.entity = entity

class GenericMultiEntityResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('entities', data.Entity)))

    def __init__(self, entities=None, **kwargs):
        super(GenericMultiEntityResponse, self).__init__(**kwargs)
        self.entities = entities

class EntityService(service.Service):
    METHODS = service.servicemethods(
        ('get', EntityGetRequest, EntityGetResponse),
        ('mutate', EntityMutateRequest, EntityMutateResponse),
        ('mutatecomments', EntityMutateCommentRequest, EntityMutateCommentResponse),
        ('googleplacetoentity', GooglePlaceToEntityRequest, GenericEntityResponse),
        ('urltoentities', UrlToEntitiesRequest, GenericMultiEntityResponse),
        ('pagesourcetoentities', PageSourceToEntityRequest, GenericMultiEntityResponse),
        ('googletextsearchtoentities', GoogleTextSearchToEntitiesRequest, GenericMultiEntityResponse),
        ('sitesearchtoentities', SiteSearchToEntitiesRequest, GenericMultiEntityResponse))

    def __init__(self, session_info=None):
        self.session_info = session_info
        self.validation_errors = []

    def raise_if_errors(self):
        if self.validation_errors:
            raise service.ServiceException.request_error(self.validation_errors)

    def get(self, request):
        if not request.trip_plan_id:
            self.validation_errors.append(service.ServiceError.from_enum(
                CommonError.MISSING_FIELD, 'trip_plan_id'))
        self.raise_if_errors()
        trip_plan = data.load_trip_plan_by_id(request.trip_plan_id)
        response_summary = None
        if (request.if_modified_after and trip_plan.last_modified
            and trip_plan.last_modified_datetime() <= request.if_modified_after_as_datetime()):
            entities = []
            response_summary = EntityGetResponse.ResponseSummary.NO_CHANGES_SINCE_LAST_MODIFIED.name
        else:
            entities = trip_plan.entities if trip_plan else ()

        comments = utils.flatten(e.comments for e in entities if e.comments)
        self.migrate_comment_authors(comments)
        self.resolve_comment_display_users(comments)

        return EntityGetResponse(response_code=service.ResponseCode.SUCCESS.name,
            response_summary=response_summary,
            entities=entities,
            last_modified=trip_plan.last_modified if trip_plan else None)

    def mutate(self, request):
        operations = OperationData.from_input(request.operations, field_path_prefix='operations')
        self.validate_operation_fields(operations)
        trip_plans = data.load_trip_plans_by_ids(request.trip_plan_ids())
        trip_plans_by_id = utils.dict_from_attrs(trip_plans, 'trip_plan_id')
        for op in operations:
            op.trip_plan = trip_plans_by_id.get(op.operation.trip_plan_id)
        self.validate_editability(operations)
        self.validate_ordering(operations)
        self.process_adds(OperationData.filter_by_operator(operations, Operator.ADD))
        self.process_edits(OperationData.filter_by_operator(operations, Operator.EDIT))
        self.process_deletes(OperationData.filter_by_operator(operations, Operator.DELETE))
        for trip_plan in trip_plans:
            data.save_trip_plan(trip_plan)
        entities = [op.result for op in operations]
        return EntityMutateResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            # TODO: This implementation for last_modified is currently insufficient
            # if multiple trip plans are being edited together, since each will be saved
            # at a different time.
            entities=entities, last_modified=trip_plans[0].last_modified)

    def validate_operation_fields(self, operations):
        for op in operations:
            if not op.operation.trip_plan_id:
                self.validation_errors.append(op.missingfield('trip_plan_id'))
            # Comments are read-only
            op.operation.comments = None
        self.raise_if_errors()

    def validate_editability(self, operations):
        for op in operations:
            if not op.trip_plan:
                self.validation_errors.append(op.newerror(EntityServiceError.NO_TRIP_PLAN_FOUND, field_name='trip_plan_id'))
            elif not op.trip_plan.editable_by(self.session_info):
                self.validation_errors.append(op.newerror(CommonError.NOT_AUTHORIZED_FOR_OPERATION,
                    'The user is not allowed to edit this trip plan.', 'trip_plan_id'))
        self.raise_if_errors()

    def validate_ordering(self, operations):
        entities_in_this_req = [op_data.operation.entity.entity_id for op_data in operations]
        positions = {}
        for op_data in operations:
            op = op_data.operation
            if op.entity.day >= 0 or op.entity.day_position >= 0:
                for entity in op_data.trip_plan.entities:
                    if entity.entity_id not in entities_in_this_req:
                        positions[(op_data.trip_plan.trip_plan_id, entity.day, entity.day_position)] = entity.entity_id
                new_position_info = (op.trip_plan_id, op.entity.day, op.entity.day_position)
                existing_entity_id_at_position = positions.get(new_position_info)
                if existing_entity_id_at_position and existing_entity_id_at_position != op.entity.entity_id:
                    self.validation_errors.append(op_data.newerror(EntityServiceError.DUPLICATE_POSITIONS,
                        'The same day_position was referenced in more than one entity in this trip plan',
                        'entity.day_position'))
                else:
                    positions[new_position_info] = op.entity.entity_id
        self.raise_if_errors()

    def process_adds(self, operations):
        for op in operations:
            entity = op.operation.entity
            entity.entity_id = data.generate_entity_id()
            op.trip_plan.entities.append(entity)
            op.result = entity

    def process_edits(self, operations):
        for op in operations:
            entity = op.operation.entity
            for i, e in enumerate(op.trip_plan.entities):
                if e.entity_id == entity.entity_id:
                    op.result = op.trip_plan.entities[i].update(entity)
                    # Negative positions are a signal to clear the value.
                    # You can't send None because that's the same as telling the service
                    # to ignore the value.
                    if op.result.day < 0:
                        op.result.day = None
                    if op.result.day_position < 0:
                        op.result.day_position = None

    def process_deletes(self, operations):
        for op in operations:
            for i, entity in enumerate(op.trip_plan.entities):
                if entity.entity_id == op.operation.entity.entity_id:
                    op.result = op.trip_plan.entities.pop(i)
                    break

    def mutatecomments(self, request):
        self.validate_logged_in()

        operations = OperationData.from_input(request.operations, field_path_prefix='operations')
        trip_plans = data.load_trip_plans_by_ids(request.trip_plan_ids())
        trip_plans_by_id = utils.dict_from_attrs(trip_plans, 'trip_plan_id')
        for op in operations:
            op.trip_plan = trip_plans_by_id.get(op.operation.trip_plan_id)
        self.validate_editability(operations)
        self.validate_mutatecomments_fields(operations)

        all_comments = [operation.comment for operation in request.operations]
        self.migrate_comment_authors(all_comments)
        self.resolve_comment_display_users(all_comments)

        for add_op in OperationData.filter_by_operator(operations, Operator.ADD):
            add_op.operation.comment.comment_id = data.generate_comment_id()
            add_op.operation.comment.set_last_modified_datetime(datetime.datetime.now(tz.tzutc()))
            add_op.operation.comment.user = data.DisplayUser(
                self.session_info.db_user.public_id, self.session_info.db_user.display_name)
            entity = add_op.trip_plan.entity_by_id(add_op.operation.comment.entity_id)
            entity.append_comment(add_op.operation.comment)
            add_op.result = add_op.operation.comment
        for edit_op in OperationData.filter_by_operator(operations, Operator.EDIT):
            entity = edit_op.trip_plan.entity_by_id(edit_op.operation.comment.entity_id)
            original_comment = entity.comment_by_id(edit_op.operation.comment.comment_id)
            self.migrate_comment_authors([original_comment])
            if original_comment.user.public_id != self.session_info.db_user.public_id:
                self.validation_errors.append(
                    edit_op.newerror(EntityServiceError.NOT_AUTHORIZED_FOR_OPERATION, field_name='comment.author'))
                continue
            original_comment.set_last_modified_datetime(datetime.datetime.now(tz.tzutc()))
            original_comment.text = edit_op.operation.comment.text
            edit_op.result = original_comment
        for delete_op in OperationData.filter_by_operator(operations, Operator.DELETE):
            entity = delete_op.trip_plan.entity_by_id(delete_op.operation.comment.entity_id)
            delete_op.result = entity.delete_comment_by_id(delete_op.operation.comment.comment_id)

        self.raise_if_errors()

        for trip_plan in trip_plans:
            data.save_trip_plan(trip_plan)
        comments = [op.result for op in operations]
        return EntityMutateCommentResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            # TODO: This implementation for last_modified is currently insufficient
            # if multiple trip plans are being edited together, since each will be saved
            # at a different time.
            comments=comments, last_modified=trip_plans[0].last_modified)

    def validate_logged_in(self):
        if not self.session_info.logged_in():
            self.validation_errors.append(service.ServiceError.from_enum(CommonError.NOT_LOGGED_IN))
            self.raise_if_errors()

    def validate_mutatecomments_fields(self, operations):
        for op in operations:
            if not op.operation.trip_plan_id:
                self.validation_errors.append(op.missingfield('trip_plan_id'))
            if not op.operation.comment.entity_id:
                self.validation_errors.append(op.missingfield('comment.entity_id'))
            if op.operation.operator in (Operator.EDIT.name, Operator.DELETE.name):
                if not op.operation.comment.comment_id:
                    self.validation_errors.append(op.missingfield('comment.comment_id'))
            if op.operation.operator == Operator.ADD.name:
                if not op.operation.comment.text:
                    self.validation_errors.append(op.missingfield('comment.text'))
        self.raise_if_errors()

    def googleplacetoentity(self, request):
        result = google_places.lookup_place_by_reference(request.reference)
        return GenericEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entity=result.to_entity() if result else None)

    def urltoentities(self, request):
        url = request.url
        if url.startswith('//'):
            url = 'http:' + url
        if not url.startswith('http'):
            url = 'http://' + url
        entities = clip_logic.scrape_entities_from_url(url)
        return GenericMultiEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entities=entities)

    def pagesourcetoentities(self, request):
        # TODO: Move unicode encoding into the json deserializer
        entities = clip_logic.scrape_entities_from_page_source(
            request.url, request.page_source.encode('utf-8'))
        return GenericMultiEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entities=entities)

    def googletextsearchtoentities(self, request):
        latlng = request.latlng.to_json_obj() if request.latlng else None
        results = geocode.search_for_places(request.query, latlng,
            radius_meters=10000, max_results=request.max_results) or []
        def lookup_entity(result):
            place = google_places.lookup_place_by_reference(result.get_reference())
            return place.to_entity() if place else None
        raw_entities = utils.parallelize(lookup_entity, [(result,) for result in results])
        entities = [e for e in raw_entities if e]
        return GenericMultiEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entities=entities)

    def sitesearchtoentities(self, request):
        site = sample_sites.find_site_by_host(request.site_host)
        if not site:
            self.validation_errors.append(service.ServiceError.from_enum(
                EntityServiceError.UNKNOWN_SITE, 'site_host'))
        self.raise_if_errors()
        url = site.resolve_search_url(request.location_name,
            request.location_latlng, request.query)
        default_max_results = 10
        entities = clip_logic.scrape_entities_from_url(url, force_fetch_page=True,
            max_results=request.max_results or default_max_results)
        return GenericMultiEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entities=entities)

    def migrate_comment_authors(self, comments):
        for comment in comments:
            if comment.author and (not comment.user or not comment.user.public_id):
                db_user = user.User.query.filter_by(email=comment.author).first()
                if db_user:
                    comment.user = data.DisplayUser(db_user.public_id, db_user.display_name)

    def resolve_comment_display_users(self, comments):
        public_ids = set(c.user.public_id for c in comments if c.user)
        if not public_ids:
            return
        resolver = user.DisplayNameResolver()
        resolver.populate(public_ids)
        for comment in comments:
            if comment.user and comment.user.public_id:
                comment.user.display_name = resolver.resolve(comment.user.public_id)

TripPlanServiceError = enums.enum('NO_TRIP_PLAN_FOUND', 'INVALID_GOOGLE_MAPS_URL')

class TripPlanGetRequest(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields(serializable.listf('trip_plan_ids'), 'include_entities', 'include_notes')

    def __init__(self, trip_plan_ids=(), include_entities=False, include_notes=False):
        self.trip_plan_ids = trip_plan_ids
        self.include_entities = include_entities
        self.include_notes = include_notes

class TripPlanGetResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('trip_plans', data.TripPlan)))

    def __init__(self, trip_plans=(), **kwargs):
        super(TripPlanGetResponse, self).__init__(**kwargs)
        self.trip_plans = trip_plans

class TripPlanOperation(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('operator', serializable.objf('trip_plan', data.TripPlan))

    def __init__(self, operator=None, trip_plan=None):
        self.operator = operator
        self.trip_plan = trip_plan

class TripPlanMutateRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields(serializable.objlistf('operations', TripPlanOperation))

    def __init__(self, operations=()):
        self.operations = operations

    def trip_plan_ids(self):
        return set(operation.trip_plan.trip_plan_id for operation in self.operations if operation.trip_plan.trip_plan_id)

class TripPlanMutateResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('trip_plans', data.TripPlan)))

    def __init__(self, trip_plans=(), **kwargs):
        super(TripPlanMutateResponse, self).__init__(**kwargs)
        self.trip_plans = trip_plans

class TripPlanCloneRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id')

    def __init__(self, trip_plan_id=None):
        self.trip_plan_id = trip_plan_id

class TripPlanCloneResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objf('trip_plan', data.TripPlan)))

    def __init__(self, trip_plan=None, **kwargs):
        super(TripPlanCloneResponse, self).__init__(**kwargs)
        self.trip_plan = trip_plan

class GmapsImportRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('gmaps_url')

    def __init__(self, gmaps_url=None):
        self.gmaps_url = gmaps_url

class GmapsImportResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objf('trip_plan', data.TripPlan)))

    def __init__(self, trip_plan=None, **kwargs):
        super(GmapsImportResponse, self).__init__(**kwargs)
        self.trip_plan = trip_plan

class FindTripPlansRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields(serializable.objf('location_latlng', data.LatLng))

    def __init__(self, location_latlng=None):
        self.location_latlng = location_latlng

class FindTripPlansResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('trip_plans', data.TripPlan)))

    def __init__(self, trip_plans=None, **kwargs):
        super(FindTripPlansResponse, self).__init__(**kwargs)
        self.trip_plans = trip_plans

class CollaboratorOperation(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('operator', 'trip_plan_id',
        'invitee_email', 'collaborator_public_id')

    def __init__(self, operator=None, trip_plan_id=None, invitee_email=None, collaborator_public_id=None):
        self.operator = operator
        self.trip_plan_id = trip_plan_id
        self.invitee_email = invitee_email
        self.collaborator_public_id = collaborator_public_id

class MutateCollaboratorsRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields(serializable.objlistf('operations', CollaboratorOperation))

    def __init__(self, operations=()):
        self.operations = operations

class TripPlanCollaborators(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields(
        serializable.objlistf('editors', data.DisplayUser),
        serializable.listf('invitee_emails'))

    def __init__(self, editors=None, invitee_emails=None):
        self.editors = editors or []
        self.invitee_emails = invitee_emails or []

class MutateCollaboratorsResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(
            serializable.objlistf('collaborators', TripPlanCollaborators),
            'last_modified'))

    def __init__(self, collaborators=None, last_modified=None, **kwargs):
        super(MutateCollaboratorsResponse, self).__init__(**kwargs)
        self.collaborators = collaborators
        self.last_modified = last_modified

class TripPlanService(service.Service):
    METHODS = service.servicemethods(
        ('get', TripPlanGetRequest, TripPlanGetResponse),
        ('mutate', TripPlanMutateRequest, TripPlanMutateResponse),
        ('clone', TripPlanCloneRequest, TripPlanCloneResponse),
        ('mutatecollaborators', MutateCollaboratorsRequest, MutateCollaboratorsResponse),
        ('gmapsimport', GmapsImportRequest, GmapsImportResponse),
        ('findtripplans', FindTripPlansRequest, FindTripPlansResponse))

    def __init__(self, session_info=None):
        self.session_info = session_info
        self.validation_errors = []

    def raise_if_errors(self):
        if self.validation_errors:
            raise service.ServiceException.request_error(self.validation_errors)

    def get(self, request):
        if request.trip_plan_ids:
            trip_plans = data.load_trip_plans_by_ids(request.trip_plan_ids)
        else:
            trip_plans = data.load_all_trip_plans(self.session_info)
        if not request.include_entities:
            for trip_plan in trip_plans:
                trip_plan.entities = ()
        if not request.include_notes:
            for trip_plan in trip_plans:
                trip_plan.notes = ()

        self.migrate_creators(trip_plans)
        self.resolve_display_users(trip_plans)

        return TripPlanGetResponse(response_code=service.ResponseCode.SUCCESS.name,
            trip_plans=trip_plans)

    def mutate(self, request):
        operations = OperationData.from_input(request.operations, field_path_prefix='operations')
        self.prepare_operations(request, operations)
        self.validate_fields(operations)
        self.validate_editability(operations)
        self.process_adds(OperationData.filter_by_operator(operations, Operator.ADD))
        self.process_edits(OperationData.filter_by_operator(operations, Operator.EDIT))
        self.process_deletes(OperationData.filter_by_operator(operations, Operator.DELETE))
        for trip_plan in [op.result for op in operations]:
            data.save_trip_plan(trip_plan)
        results = [op.result.copy().strip_child_objects() for op in operations]
        self.resolve_display_users(results)
        return TripPlanMutateResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            trip_plans=results)

    def prepare_operations(self, request, operations):
        for op in operations:
            op.operation.trip_plan.strip_readonly_fields()
        trip_plan_ids = request.trip_plan_ids()
        if trip_plan_ids:
            trip_plans = data.load_trip_plans_by_ids(trip_plan_ids)
            trip_plans_by_id = utils.dict_from_attrs(trip_plans, 'trip_plan_id')
        else:
            trip_plans_by_id = {}
        for op in operations:
            op.trip_plan = trip_plans_by_id.get(op.operation.trip_plan.trip_plan_id)

    def validate_fields(self, operations):
        ids_seen = set()
        for op in operations:
            trip_plan_id = op.operation.trip_plan.trip_plan_id
            if op.operation.operator == Operator.ADD.name:
                if not op.operation.trip_plan.name:
                    self.validation_errors.append(op.missingfield('trip_plan.name'))
            else:
                if not trip_plan_id:
                    self.validation_errors.append(op.missingfield('trip_plan.trip_plan_id'))
                elif not op.trip_plan:
                    self.validation_errors.append(op.newerror(
                        TripPlanServiceError.NO_TRIP_PLAN_FOUND, field_name='trip_plan.trip_plan_id'))
                if trip_plan_id and trip_plan_id in ids_seen:
                    self.validation_errors.append(op.newerror(
                        CommonError.OBJECT_ALREADY_REFERENCED_IN_OPERATION, field_name='trip_plan.trip_plan_id'))
                else:
                    ids_seen.add(trip_plan_id)
        self.raise_if_errors()

    def validate_editability(self, operations):
        for op in operations:
            if op.operation.operator != Operator.ADD.name:
                if not op.trip_plan.editable_by(self.session_info):
                    self.validation_errors.append(op.newerror(CommonError.NOT_AUTHORIZED_FOR_OPERATION,
                        'The user is not allowed to edit this trip plan.', 'trip_plan.trip_plan_id'))
        self.raise_if_errors()

    def process_adds(self, operations):
        for op in operations:
            trip_plan = op.operation.trip_plan
            trip_plan.trip_plan_id = data.generate_trip_plan_id()
            if self.session_info.logged_in():
                trip_plan.user = data.DisplayUser(self.session_info.db_user.public_id,
                    self.session_info.db_user.display_name)
            else:
                trip_plan.user = data.DisplayUser(public_visitor_id=self.session_info.public_visitor_id)
            op.result = trip_plan

    def process_edits(self, operations):
        for op in operations:
            op.result = op.trip_plan.update(op.operation.trip_plan)

    def process_deletes(self, operations):
        for op in operations:
            op.trip_plan.status = data.TripPlan.Status.DELETED.name
            op.result = op.trip_plan

    def clone(self, request):
        trip_plan = data.load_trip_plan_by_id(request.trip_plan_id)
        if not trip_plan:
            self.validation_errors.append(service.ServiceError(
                TripPlanServiceError.NO_TRIP_PLAN_FOUND, 'No active trip plan was found with this id.', 'trip_plan_id'))
        self.raise_if_errors()
        new_trip_plan = trip_plan.copy()
        new_trip_plan.trip_plan_id = data.generate_trip_plan_id()
        if self.session_info.logged_in():
            new_trip_plan.user = data.DisplayUser(self.session_info.db_user.public_id,
                self.session_info.db_user.display_name)
        else:
            new_trip_plan.user = data.DisplayUser(public_visitor_id=self.session_info.public_visitor_id)
        new_trip_plan.creator = None
        new_trip_plan.editors = []
        new_trip_plan.entities = self.clone_entities(trip_plan.entities)
        data.save_trip_plan(new_trip_plan)
        return TripPlanCloneResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            trip_plan=new_trip_plan)

    def clone_entities(self, entities):
        if not entities:
            return []
        new_entities = [entity.copy() for entity in entities]
        for entity in new_entities:
            entity.entity_id = data.generate_entity_id()
        return new_entities

    def mutatecollaborators(self, request):
        operations = OperationData.from_input(request.operations, field_path_prefix='operations')
        self.validate_collaborator_operations(operations)
        trip_plans = decorate_with_trip_plans('trip_plan_id', operations)
        self.validate_mutate_collaborators_editability(operations)

        for add_op in OperationData.filter_by_operator(operations, Operator.ADD):
            invitee_email = add_op.operation.invitee_email
            trip_plan = add_op.trip_plan
            db_user = user.User.get_by_email(invitee_email)
            if db_user:
                if not trip_plan.editor_exists(db_user.public_id) and not trip_plan.user.public_id == db_user.public_id:
                    trip_plan.editors.append(data.DisplayUser(db_user.public_id, db_user.display_name))
                    # The invitee probably doesn't exist but just in case they invited the
                    # user before they had an account, clean up.
                    trip_plan.remove_invitee(invitee_email)
                    self.send_invitation_email(invitee_user=db_user, trip_plan=trip_plan)
            else:
                if not trip_plan.invitee_exists(invitee_email):
                    trip_plan.invitee_emails.append(invitee_email)
                    self.send_invitation_email(invitee_email=invitee_email, trip_plan=trip_plan)
            add_op.result = TripPlanCollaborators(trip_plan.editors, trip_plan.invitee_emails)

        for delete_op in OperationData.filter_by_operator(operations, Operator.DELETE):
            trip_plan = delete_op.trip_plan
            if delete_op.operation.invitee_email:
                trip_plan.remove_invitee(delete_op.operation.invitee_email)
            elif delete_op.operation.collaborator_public_id:
                trip_plan.remove_editor(delete_op.operation.collaborator_public_id)
            delete_op.result = TripPlanCollaborators(trip_plan.editors, trip_plan.invitee_emails)

        for trip_plan in trip_plans:
            data.save_trip_plan(trip_plan)

        self.resolve_display_users(trip_plans)

        return MutateCollaboratorsResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            collaborators=[op.result for op in operations],
            # TODO: This implementation for last_modified is currently insufficient
            # if multiple trip plans are being edited together, since each will be saved
            # at a different time.
            last_modified=trip_plans[0].last_modified)

    def validate_collaborator_operations(self, operations):
        for add_op in OperationData.filter_by_operator(operations, Operator.ADD):
            if not add_op.operation.invitee_email:
                self.validation_errors.append(op.missingfield('invitee_email'))
        self.raise_if_errors()

    def validate_mutate_collaborators_editability(self, operations):
        for op in operations:
            if not op.trip_plan:
                self.validation_errors.append(op.newerror(TripPlanServiceError.NO_TRIP_PLAN_FOUND, field_name='trip_plan_id'))
            elif not op.trip_plan.editable_by(self.session_info):
                self.validation_errors.append(op.newerror(CommonError.NOT_AUTHORIZED_FOR_OPERATION,
                    'The user is not allowed to edit this trip plan.', 'trip_plan_id'))
        self.raise_if_errors()

    def send_invitation_email(self, trip_plan, invitee_user=None, invitee_email=None):
        recipient = invitee_email or invitee_user.email
        inviter = self.session_info.display_user()
        template_vars = dict(inviter=inviter, trip_plan=trip_plan,
            login_url=url_for('user.login', _external=True, next=trip_plan.trip_plan_url()),
            signup_url=url_for('user.register', _external=True, next=trip_plan.trip_plan_url()))
        subject = '%s has invited you to the trip plan "%s"' % (inviter.display_name, trip_plan.name)
        if invitee_email:
            template_prefix = 'emails/invite_new_user'
        else:
            template_prefix = 'emails/invite_existing_user'
        msg = mailer.render_multipart_msg(subject, [recipient], None,
            template_vars, template_prefix + '.txt', template_prefix + '.html')
        mailer.send(msg)

    def gmapsimport(self, request):
        kml_url = kml_import.get_kml_url(request.gmaps_url)
        if not kml_url:
            self.validation_errors.append(service.ServiceError(
                TripPlanServiceError.INVALID_GOOGLE_MAPS_URL.name,
                'This url could not be recognized as a valid Google Maps url.',
                'gmaps_url'))
            self.raise_if_errors()
        trip_plan = kml_import.parse_from_kml_url(kml_url)
        return GmapsImportResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            trip_plan=trip_plan)

    def migrate_creators(self, trip_plans):
        for trip_plan in trip_plans:
            if trip_plan.creator and isinstance(trip_plan.creator, basestring) and (not trip_plan.user or not trip_plan.user.public_id):
                db_user = user.User.query.filter_by(email=trip_plan.creator).first()
                if db_user:
                    trip_plan.user = data.DisplayUser(db_user.public_id, db_user.display_name)

    def resolve_display_users(self, trip_plans):
        public_ids = set()
        for trip_plan in trip_plans:
            if trip_plan.user and trip_plan.user.public_id:
                public_ids.add(trip_plan.user.public_id)
            for editor in trip_plan.editors:
                public_ids.add(editor.public_id)
        if not public_ids:
            return

        resolver = user.DisplayNameResolver()
        resolver.populate(public_ids)
        for trip_plan in trip_plans:
            if trip_plan.user and trip_plan.user.public_id:
                trip_plan.user.display_name = resolver.resolve(trip_plan.user.public_id)
            for editor in trip_plan.editors:
                editor.display_name = resolver.resolve(editor.public_id)

    FEATURED_TRIP_PLANS_USERS = (
         'admin@nytimes.com', 'admin@nomadicmatt.com', 'admin@letsgo.com',
         'admin@tripadvisor.com', 'admin@frommers.com', 'admin@travelclipper.com',
         'admin@lonelyplanet.com',
        )

    def findtripplans(self, request):
        featured_trip_plans = []
        for username in self.FEATURED_TRIP_PLANS_USERS:
            featured_trip_plans.extend(data.load_all_trip_plans_for_creator(username))
        trip_plans = []
        for trip_plan in featured_trip_plans:
            if not trip_plan.location_latlng:
                continue
            distance = geometry.earth_distance_meters(trip_plan.location_latlng.lat, trip_plan.location_latlng.lng,
                request.location_latlng.lat, request.location_latlng.lng)
            if distance < 40000:
                trip_plans.append(trip_plan)

        self.migrate_creators(trip_plans)
        self.resolve_display_users(trip_plans)

        return FindTripPlansResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            trip_plans=trip_plans)

NoteServiceError = enums.enum('NO_TRIP_PLAN_FOUND')

class NoteGetRequest(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id', 'if_modified_after')

    def __init__(self, trip_plan_id=None, if_modified_after=None):
        self.trip_plan_id = trip_plan_id
        self.if_modified_after = if_modified_after

    def if_modified_after_as_datetime(self):
        if not self.if_modified_after:
            return None
        return date_parser.parse(self.if_modified_after)

class NoteGetResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('notes', data.Entity),
        'last_modified'))

    def __init__(self, notes=(), last_modified=None, **kwargs):
        super(NoteGetResponse, self).__init__(**kwargs)
        self.notes = notes
        self.last_modified = last_modified

class NoteOperation(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('operator', 'trip_plan_id', serializable.objf('note', data.Note))

    def __init__(self, operator=None, trip_plan_id=None, note=None):
        self.operator = operator
        self.trip_plan_id = trip_plan_id
        self.note = note

class NoteMutateRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields(serializable.objlistf('operations', NoteOperation))

    def __init__(self, operations=()):
        self.operations = operations

    def trip_plan_ids(self):
        return set(operation.trip_plan_id for operation in self.operations)

class NoteMutateResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('notes', data.Note), 'last_modified'))

    def __init__(self, notes=(), last_modified=None, **kwargs):
        super(NoteMutateResponse, self).__init__(**kwargs)
        self.notes = notes
        self.last_modified = last_modified

class NoteService(service.Service):
    METHODS = service.servicemethods(
        ('get', NoteGetRequest, NoteGetResponse),
        ('mutate', NoteMutateRequest, NoteMutateResponse))

    def __init__(self, session_info=None):
        self.session_info = session_info
        self.validation_errors = []

    def raise_if_errors(self):
        if self.validation_errors:
            raise service.ServiceException.request_error(self.validation_errors)

    def get(self, request):
        if not request.trip_plan_id:
            self.validation_errors.append(service.ServiceError.from_enum(
                CommonError.MISSING_FIELD, 'trip_plan_id'))
        self.raise_if_errors()
        trip_plan = data.load_trip_plan_by_id(request.trip_plan_id)
        if (request.if_modified_after and trip_plan.last_modified
            and trip_plan.last_modified_datetime() <= request.if_modified_after_as_datetime()):
            notes = []
        else:
            notes = trip_plan.notes if trip_plan else ()
        return NoteGetResponse(response_code=service.ResponseCode.SUCCESS.name,
            notes=notes, last_modified=trip_plan.last_modified if trip_plan else None)

    def mutate(self, request):
        operations = OperationData.from_input(request.operations, field_path_prefix='operations')
        self.validate_operation_fields(operations)
        trip_plans = data.load_trip_plans_by_ids(request.trip_plan_ids())
        trip_plans_by_id = utils.dict_from_attrs(trip_plans, 'trip_plan_id')
        for op in operations:
            op.trip_plan = trip_plans_by_id.get(op.operation.trip_plan_id)
        self.validate_editability(operations)
        self.validate_ordering(operations)
        self.process_adds(OperationData.filter_by_operator(operations, Operator.ADD))
        self.process_edits(OperationData.filter_by_operator(operations, Operator.EDIT))
        self.process_deletes(OperationData.filter_by_operator(operations, Operator.DELETE))
        for trip_plan in trip_plans:
            data.save_trip_plan(trip_plan)
        notes = [op.result or {} for op in operations]
        return NoteMutateResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            notes=notes, last_modified=trip_plans[0].last_modified)

    def validate_operation_fields(self, operations):
        for op in operations:
            if not op.operation.trip_plan_id:
                self.validation_errors.append(op.missingfield('trip_plan_id'))
        self.raise_if_errors()

    def validate_editability(self, operations):
        for op in operations:
            if not op.trip_plan:
                self.validation_errors.append(op.newerror(NoteServiceError.NO_TRIP_PLAN_FOUND, field_name='trip_plan_id'))
            elif not op.trip_plan.editable_by(self.session_info):
                self.validation_errors.append(op.newerror(CommonError.NOT_AUTHORIZED_FOR_OPERATION,
                    'The user is not allowed to edit this trip plan.', 'trip_plan_id'))
        self.raise_if_errors()

    def validate_ordering(self, operations):
        # TODO: The ordering must take into account both entities and notes
        pass

    def process_adds(self, operations):
        for op in operations:
            note = op.operation.note
            note.note_id = data.generate_note_id()
            op.trip_plan.notes.append(note)
            op.result = note

    def process_edits(self, operations):
        for op in operations:
            note = op.operation.note
            for i, e in enumerate(op.trip_plan.notes):
                if e.note_id == note.note_id:
                    op.result = op.trip_plan.notes[i].update(note)

    def process_deletes(self, operations):
        for op in operations:
            for i, note in enumerate(op.trip_plan.notes):
                if note.note_id == op.operation.note.note_id:
                    op.result = op.trip_plan.notes.pop(i)
                    op.result.status = data.Note.Status.DELETED.name
                    break


class MigrateRequest(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('email')

    def __init__(self, email=None):
        self.email = email

class MigrateResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(
            serializable.objlistf('trip_plans', data.TripPlan)))

    def __init__(self, trip_plans, **kwargs):
        super(MigrateResponse, self).__init__(**kwargs)
        self.trip_plans = trip_plans

class AccountService(service.Service):
    METHODS = service.servicemethods(
        ('migrate', MigrateRequest, MigrateResponse))

    def __init__(self, session_info=None):
        self.session_info = session_info
        self.validation_errors = []

    def raise_if_errors(self):
        if self.validation_errors:
            raise service.ServiceException.request_error(self.validation_errors)

    def migrate(self, request):
        db_user = user.User.query.filter_by(email=request.email).first()

        # Temporarily handle the case of people with old-style email logins too.
        for trip_plan in data.load_all_trip_plans_for_creator(request.email) or []:
            if not trip_plan.user or not trip_plan.user.public_id:
                data.change_creator(trip_plan, db_user)

        all_guest_trip_plans = data.load_all_trip_plans_for_creator(self.session_info.visitor_id) or []
        for trip_plan in all_guest_trip_plans:
            data.change_creator(trip_plan, db_user)

        return MigrateResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            trip_plans=all_guest_trip_plans)

AdminServiceError = enums.enum('INVALID_PARSER_TYPE')

class AugmentEntitiesRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('trip_plan_id')

    def __init__(self, trip_plan_id=None):
        self.trip_plan_id = trip_plan_id

class AugmentEntitiesResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(
            serializable.objlistf('entities', data.Entity)))

    def __init__(self, entities=None, **kwargs):
        super(AugmentEntitiesResponse, self).__init__(**kwargs)
        self.entities = entities

class ParseTripPlanRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('url', 'augment_entities',
        'parser_type', 'creator', 'trip_plan_name')

    def __init__(self, url=None, augment_entities=None,
            parser_type=None, creator=None, trip_plan_name=None):
        self.url = url
        self.augment_entities = augment_entities
        self.parser_type = parser_type
        self.creator = creator
        self.trip_plan_name = trip_plan_name

class ParseTripPlanResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(
            serializable.objf('trip_plan', data.TripPlan),
            serializable.objlistf('entities', data.Entity)))

    def __init__(self, trip_plan=None, entities=None, **kwargs):
        super(ParseTripPlanResponse, self).__init__(**kwargs)
        self.trip_plan = trip_plan
        self.entities = entities

class AdminService(service.Service):
    METHODS = service.servicemethods(
        ('augmententities', AugmentEntitiesRequest, AugmentEntitiesResponse),
        ('parsetripplan', ParseTripPlanRequest, ParseTripPlanResponse))

    def __init__(self, session_info=None):
        self.session_info = session_info
        self.validation_errors = []

    def raise_if_errors(self):
        if self.validation_errors:
            raise service.ServiceException.request_error(self.validation_errors)

    def validate_admin_auth(self):
        if not self.session_info.is_admin():
            self.validation_errors.append(service.ServiceError.from_enum(
                CommonError.NOT_AUTHORIZED_FOR_OPERATION))
        self.raise_if_errors()

    def augmententities(self, request):
        self.validate_admin_auth()
        trip_plan = data.load_trip_plan_by_id(request.trip_plan_id)
        augmented_trip_plan = trip_plan_creator.augment_trip_plan(trip_plan)
        data.save_trip_plan(augmented_trip_plan)
        return AugmentEntitiesResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entities=augmented_trip_plan.entities)

    def parsetripplan(self, request):
        tp_creator = trip_plan_creator.TripPlanCreator(request.url,
            request.creator, request.trip_plan_name, request.parser_type)
        if not tp_creator:
            self.validation_errors.append(service.ServiceError.from_enum(
                AdminServiceError.INVALID_PARSER_TYPE, 'parser_type'))
            self.raise_if_errors()
        if request.augment_entities:
            trip_plan = tp_creator.parse_full()
        else:
            trip_plan = tp_creator.parse_candidate()
        trip_plan.trip_plan_id = data.generate_trip_plan_id()
        data.save_trip_plan(trip_plan)
        entities = trip_plan.entities
        trip_plan.entities = ()
        return ParseTripPlanResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            trip_plan=trip_plan, entities=entities)

