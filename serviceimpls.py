import data
import enums
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

class EntityService(service.Service):
    METHODS = service.servicemethods(
        ('mutate', EntityServiceMutateRequest, EntityServiceMutateResponse))

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
                    op.trip_plan.entities[i] = entity
                    op.result = op.trip_plan.entities[i]

    def process_deletes(self, operations):
        for op in operations:
            for i, entity in enumerate(op.trip_plan.entities):
                if entity.entity_id == op.operation.entity.entity_id:
                    op.result = op.trip_plan.entities.pop(i)
                    break

