import serializable

class ServiceRequest(object):
    pass

class ServiceResponse(object):
    def __init__(self):
        self.response_code = None
        self.error = None

class ServiceError(object):
    def __init__(self, error_code, message):
        self.error_code = error_code
        self.message = message

class ServiceException(Exception):
    def __init__(self, response_code, error_code, message):
        self.response_code = response_code
        self.error_code = error_code
        self.message = message

    def error(self):
        return ServiceError(self.error_code, self.message)

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

    def resolve_method(self, method_name):
        descriptor = self.METHODS.get(method_name)
        if not descriptor:
            raise Exception('No descriptor for method of name %s' % method_name)
        if not hasattr(self, method_name):
            raise Exception('Method %s not implemented' % method_name)
        return descriptor

    def process_exception(self, exception, response):
        response.response_code = exception.response_code
        response.error = exception.error()


class JsonServiceError(ServiceError, serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('error_code', 'message')

class JsonServiceException(ServiceException):
    @classmethod
    def from_service_exception(e):
        return JsonServiceException(e.response_code, e.error_code, e.message)

    def error(self):
        return JsonServiceError(self.error_code, self.message)

class JsonServiceRequest(ServiceRequest, serializable.Serializable):
    pass

class JsonServiceResponse(ServiceResponse, serializable.Serializable):
    PUBLIC_FIELDS = serializable.fields('response_code', serializable.objf('error', JsonServiceError))

class JsonService(Service):
    def invoke_with_json(self, method_name, json_request):
        method_descriptor = self.resolve_method(method_name)
        request = method_descriptor.request_class.from_json_obj(json_request)
        try:
            response = self.invoke(method_name, request)
        except ServiceException as e:
            response = method_descriptor.response_class()

            response.response_code = e.response_code
            response.error = e.error
        return response.to_json_obj() if response else None

    def process_exception(self, exception, response):
        wrapped_exception = JsonServiceException.from_service_exception(exception)
        super(JsonService, self).process_exception(wrapped_exception, response)
