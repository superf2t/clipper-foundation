from flask.ext import user
from flask.ext.user import forms
import wtforms

from app_core import db
import crypto

class User(db.Model, user.UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    active = db.Column(db.Boolean(), nullable=False, default=False)
    password = db.Column(db.String(255), nullable=False, default='')
    email = db.Column(db.String(255), nullable=False, unique=True)
    confirmed_at = db.Column(db.DateTime())
    reset_password_token = db.Column(db.String(100), nullable=False, default='')
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    display_name = db.Column(db.String(50), nullable=False)

    @property
    def public_id(self):
        if self.id and not hasattr(self, '_cached_public_id'):
            self._cached_public_id = crypto.encrypt_id(self.id)
        return self._cached_public_id

    @classmethod
    def get_by_public_ids(cls, public_ids):
        ids = [crypto.decrypt_id(public_id) for public_id in public_ids]
        return cls.query.filter(User.id.in_(ids))

class TCRegisterForm(forms.RegisterForm):
    # TODO: Add validators and make required
    first_name = wtforms.StringField('First Name')
    last_name = wtforms.StringField('Last Name')
    display_name = wtforms.StringField('Display Name - what will be shown on trip plans authored by you')
    next = wtforms.StringField()