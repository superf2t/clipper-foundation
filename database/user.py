from flask.ext import user
from flask.ext.user import forms
import wtforms

from app_core import db

class User(db.Model, user.UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    active = db.Column(db.Boolean(), nullable=False, default=False)
    password = db.Column(db.String(255), nullable=False, default='')
    email = db.Column(db.String(255), nullable=False, unique=True)
    confirmed_at = db.Column(db.DateTime())
    reset_password_token = db.Column(db.String(100), nullable=False, default='')
    display_name = db.Column(db.String(50), nullable=False)

class TCRegisterForm(forms.RegisterForm):
    display_name = wtforms.StringField('Display Name')
