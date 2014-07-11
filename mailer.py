from flask import render_template
from flask.ext import mail

import app_core

def render_multipart_msg(subject, recipients, sender=None,
        template_vars={}, text_template_name=None, html_template_name=None):
    msg = mail.Message(subject, sender=sender, recipients=recipients)
    if text_template_name:
        msg.body = render_template(text_template_name, **template_vars)
    if html_template_name:
        msg.html = render_template(html_template_name, **template_vars)
    return msg

def send(msg):
    return app_core.mail.send(msg)
