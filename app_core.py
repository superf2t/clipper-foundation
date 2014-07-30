from flask import Flask
from flask.ext import babel
from flask.ext import mail
from flask.ext import sqlalchemy

import constants

class MyFlask(Flask):
    jinja_options = dict(Flask.jinja_options)
    jinja_options['extensions'].append('jinja2htmlcompress.SelectiveHTMLCompress')

    def get_send_file_max_age(self, name):
        if name.startswith('js/') or name.startswith('css/'):
            return 0
        return super(MyFlask, self).get_send_file_max_age(name)

class AppConfig(object):
    SECRET_KEY = constants.FLASK_SECRET_KEY
    SQLALCHEMY_DATABASE_URI = constants.SQLALCHEMY_DATABASE_URI
    CSRF_ENABLED = True
    USER_ENABLE_EMAIL = False

    # Configure Flask-Mail
    MAIL_SERVER   = 'smtp.gmail.com'
    MAIL_PORT     = 465
    MAIL_USE_SSL  = True
    MAIL_USERNAME = constants.MAIL_USERNAME
    MAIL_PASSWORD = constants.MAIL_PASSWORD
    MAIL_DEFAULT_SENDER = 'TravelClipper <noreply@unicyclelabs.com>'

   # Configure Flask-User
    USER_ENABLE_EMAIL                = True
    USER_ENABLE_USERNAME             = False
    USER_ENABLE_CONFIRM_EMAIL        = True
    USER_ENABLE_CHANGE_USERNAME      = False
    USER_ENABLE_CHANGE_PASSWORD      = True
    USER_ENABLE_FORGOT_PASSWORD      = True
    USER_ENABLE_RETYPE_PASSWORD      = False
    USER_SEND_REGISTERED_EMAIL       = True
    USER_SEND_PASSWORD_CHANGED_EMAIL = True
    USER_SEND_USERNAME_CHANGED_EMAIL = False
    USER_LOGIN_TEMPLATE = 'flask_user/login.html'
    USER_REGISTER_TEMPLATE = 'flask_user/register.html'

app = MyFlask(__name__)
app.config.from_object(__name__+'.AppConfig')

babel = babel.Babel(app)
db = sqlalchemy.SQLAlchemy(app)
mail = mail.Mail(app)

if not constants.DEBUG:
    import logging
    import os
    projectpath = os.environ.get('PROJECTPATH') or '.'
    file_handler = logging.FileHandler(projectpath + '/app.log')
    file_handler.setLevel(logging.WARNING)
    app.logger.addHandler(file_handler)
