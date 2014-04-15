import enums
import serializable

class ServiceError(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('error_code', 'message', 'field_path')

    def __init__(self, error_code=None, message=None, field_path=None):
        self.error_code = error_code
        self.message = message
        self.field_path = field_path

    @classmethod
    def from_enum(cls, error_enum, field_path=None):
        return cls(error_enum.name, getattr(error_enum, 'message'), field_path)

class ServiceException(Exception):
    def __init__(self, response_code=None, errors=()):
        self.response_code = response_code
        self.errors = errors

    @classmethod
    def server_error(cls, errors=()):
        return ServiceException(ResponseCode.SERVER_ERROR.name, errors)

    @classmethod
    def request_error(cls, errors=()):
        return ServiceException(ResponseCode.REQUEST_ERROR.name, errors)

class ServiceRequest(serializable.Serializable):
    pass

ResponseCode = enums.enum('SUCCESS', 'SERVER_ERROR', 'REQUEST_ERROR')

class ServiceResponse(serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('response_code',
        serializable.objlistf('errors', ServiceError))

    def __init__(self, response_code=None, errors=()):
        self.response_code = response_code
        self.errors = errors

class MethodDescriptor(object):
    def __init__(self, method_name, request_class, response_class):
        self.method_name = method_name
        self.request_class = request_class
        self.response_class = response_class

def servicemethods(*methods):
    result = {} 
    for method_name, request_class, response_class in methods:
        result[method_name] = MethodDescriptor(method_name, request_class, response_class)
    return result

class Service(object):
    METHODS = servicemethods()

    def invoke(self, method_name, request):
        method_descriptor = self.resolve_method(method_name)
        method = getattr(self, method_descriptor.method_name)
        try:
            response = method(request)
        except ServiceException as e:
            response = method_descriptor.response_class()
            self.process_exception(e, response)
        return response

    def invoke_with_json(self, method_name, json_request):
        method_descriptor = self.resolve_method(method_name)
        request = method_descriptor.request_class.from_json_obj(json_request)
        response = self.invoke(method_name, request)
        return response.to_json_obj() if response else None

    def resolve_method(self, method_name):
        descriptor = self.METHODS.get(method_name)
        if not descriptor:
            raise Exception('No descriptor for method of name %s' % method_name)
        if not hasattr(self, method_name):
            raise Exception('Method %s not implemented' % method_name)
        return descriptor

    def process_exception(self, exception, response):
        response.response_code = exception.response_code
        response.errors = exception.errors
