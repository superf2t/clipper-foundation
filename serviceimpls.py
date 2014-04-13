import data
import enums
import clip_logic
import google_places
import serializable
import service
import utils

Operator = enums.enum('ADD', 'EDIT', 'DELETE')

CommonError = enums.enum(
    NO_CREDENTIALS=enums.enumdata(message=None),
    NOT_AUTHORIZED_FOR_OPERATION=enums.enumdata(message='The user is not authorized to perform this action'),
    MISSING_FIELD=enums.enumdata(message='A required field is missing'))

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

    def is_add(self):
        return self.operation.operator == Operator.ADD.name

    @classmethod
    def filter_by_operator(cls, op_datas, operator):
        return [op for op in op_datas if op.operation.operator == operator.name]

    @classmethod
    def from_input(cls, operations, field_path_prefix=''):
        return [OperationData(op, field_path_prefix=field_path_prefix, index=i) for i, op in enumerate(operations)]


EntityServiceError = enums.enum('NO_TRIP_PLAN_FOUND')

class EntityOperation(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('operator', 'trip_plan_id_str', serializable.objf('entity', data.Entity))

    def __init__(self, operator=None, trip_plan_id_str=None, entity=None):
        self.operator = operator
        self.trip_plan_id_str = trip_plan_id_str
        self.entity = entity

    @property
    def trip_plan_id(self):
        return int(self.trip_plan_id_str)

class EntityServiceMutateRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields(serializable.objlistf('operations', EntityOperation))

    def __init__(self, operations=()):
        self.operations = operations

    def trip_plan_ids(self):
        return [operation.trip_plan_id for operation in self.operations]

class EntityServiceMutateResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('entities', data.Entity)))

    def __init__(self, entities=(), **kwargs):
        super(EntityServiceMutateResponse, self).__init__(**kwargs)
        self.entities = entities

class GooglePlaceToEntityRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('reference')

    def __init__(self, reference=None):
        self.reference = reference

class UrlToEntityRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('url')

    def __init__(self, url=None):
        self.url = url

class PageSourceToEntityRequest(service.ServiceRequest):
    PUBLIC_FIELDS = serializable.fields('url', 'page_source')

    def __init__(self, url=None, page_source=None):
        self.url = url
        self.page_source = page_source

class GenericEntityResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objf('entity', data.Entity)))

    def __init__(self, entity=None, **kwargs):
        super(GenericEntityResponse, self).__init__(**kwargs)
        self.entity = entity

class EntityService(service.Service):
    METHODS = service.servicemethods(
        ('mutate', EntityServiceMutateRequest, EntityServiceMutateResponse),
        ('googleplacetoentity', GooglePlaceToEntityRequest, GenericEntityResponse),
        ('urltoentity', UrlToEntityRequest, GenericEntityResponse),
        ('pagesourcetoentity', PageSourceToEntityRequest, GenericEntityResponse))

    def __init__(self, session_info=None):
        self.session_info = session_info
        self.validation_errors = []

    def raise_if_errors(self):
        if self.validation_errors:
            raise service.ServiceException.request_error(self.validation_errors)

    def mutate(self, request):
        operations = OperationData.from_input(request.operations, field_path_prefix='operations')
        self.validate_operation_fields(operations)
        trip_plans = data.load_trip_plans_by_ids(request.trip_plan_ids())
        trip_plans_by_id = utils.dict_from_attrs(trip_plans, 'trip_plan_id')
        for op in operations:
            op.trip_plan = trip_plans_by_id.get(op.operation.trip_plan_id)
        self.validate_editability(operations)
        self.process_adds(OperationData.filter_by_operator(operations, Operator.ADD))
        self.process_edits(OperationData.filter_by_operator(operations, Operator.EDIT))
        self.process_deletes(OperationData.filter_by_operator(operations, Operator.DELETE))
        for trip_plan in trip_plans:
            data.save_trip_plan(trip_plan)
        entities = [op.result for op in operations]
        return EntityServiceMutateResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entities=entities)

    def validate_operation_fields(self, operations):
        for op in operations:
            if not op.operation.trip_plan_id_str:
                self.validation_errors.append(op.missingfield('trip_plan_id_str'))
        self.raise_if_errors()

    def validate_editability(self, operations):
        for op in operations:
            if not op.trip_plan:
                self.validation_errors.append(op.newerror(EntityServiceError.NO_TRIP_PLAN_FOUND, field_name='trip_plan_id_str'))
            elif not op.trip_plan.editable_by(self.session_info):
                self.validation_errors.append(op.newerror(CommonError.NOT_AUTHORIZED_FOR_OPERATION,
                    'The user is not allowed to edit this trip plan.', 'trip_plan_id_str'))
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

    def process_deletes(self, operations):
        for op in operations:
            for i, entity in enumerate(op.trip_plan.entities):
                if entity.entity_id == op.operation.entity.entity_id:
                    op.result = op.trip_plan.entities.pop(i)
                    break

    def googleplacetoentity(self, request):
        result = google_places.lookup_place_by_reference(request.reference)
        return GenericEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entity=result.to_entity() if result else None)

    def urltoentity(self, request):
        entity = clip_logic.scrape_entity_from_url(request.url)
        return GenericEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entity=entity)

    def pagesourcetoentity(self, request):
        # TODO: Move unicode encoding into the json deserializer
        entity = clip_logic.scrape_entity_from_url(request.url, request.page_source.encode('utf-8'))
        return GenericEntityResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            entity=entity)


TripPlanServiceError = enums.enum('NO_TRIP_PLAN_FOUND')

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
        return [operation.trip_plan.trip_plan_id for operation in self.operations if operation.trip_plan.trip_plan_id]

class TripPlanMutateResponse(service.ServiceResponse):
    PUBLIC_FIELDS = serializable.compositefields(
        service.ServiceResponse.PUBLIC_FIELDS,
        serializable.fields(serializable.objlistf('trip_plans', data.TripPlan)))

    def __init__(self, trip_plans=(), **kwargs):
        super(TripPlanMutateResponse, self).__init__(**kwargs)
        self.trip_plans = trip_plans


class TripPlanService(service.Service):
    METHODS = service.servicemethods(
        ('mutate', TripPlanMutateRequest, TripPlanMutateResponse))

    def __init__(self, session_info=None):
        self.session_info = session_info
        self.validation_errors = []

    def raise_if_errors(self):
        if self.validation_errors:
            raise service.ServiceException.request_error(self.validation_errors)

    def mutate(self, request):
        operations = OperationData.from_input(request.operations, field_path_prefix='operations')
        self.prepare_operations(operations)
        self.validate_fields(operations)
        self.validate_editability(operations)
        self.process_adds(OperationData.filter_by_operator(operations, Operator.ADD))
        self.process_edits(OperationData.filter_by_operator(operations, Operator.EDIT))
        self.process_deletes(OperationData.filter_by_operator(operations, Operator.DELETE))
        for trip_plan in trip_plans + [op.result for op in operations if op.is_add()]:
            data.save_trip_plan(trip_plan)
        results = [op.result.copy().strip_child_objects() for op in operations]
        return TripPlanMutateResponse(
            response_code=service.ResponseCode.SUCCESS.name,
            trip_plans=results)

    def prepare_operations(self, operations):
        for op in operations:
            op.operation.trip_plan.strip_readonly_fields()
        trip_plan_ids = request.trip_plan_ids()
        if trip_plan_ids:
            trip_plans = data.load_trip_plans_by_ids(trip_plan_ids)
            trip_plans_by_id = utils.dict_from_attrs(trip_plans, 'trip_plan_id')
        else:
            trip_plan_ids = {}
        for op in operations:
            op.trip_plan = trip_plans_by_id.get(op.operation.trip_plan.trip_plan_id)

    def validate_fields(self, operations):
        for op in operations:
            if op.operation.operator != Operator.ADD.name:
                if not op.operation.trip_plan.trip_plan_id:
                    self.validation_errors.append(op.missingfield('trip_plan.trip_plan_id'))
                elif not op.trip_plan:
                    self.validation_errors.append(op.newerror(
                        TripPlanServiceError.NO_TRIP_PLAN_FOUND, field_name='trip_plan.trip_plan_id'))
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
            if not trip_plane.name:
                trip_plan.name = 'My First Trip'
            trip_plan.trip_plan_id = data.generate_trip_plan_id()
            trip_plan.creator = self.session_info.user_identifier
            op.result = trip_plan

    def process_edits(self, operations):
        for op in operations:
            op.result = op.trip_plan.update(op.operation.trip_plan)

    def process_deletes(self, operations):
        for op in operations:
            op.trip_plan.status = data.TripPlan.Status.DELETED.name
            op.result = op.trip_plan
