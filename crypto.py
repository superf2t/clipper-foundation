import base64

from Crypto import Random
from Crypto.Cipher import AES

import constants

BLOCK_SIZE = 16
PADDING_CHAR = '='
SALT_SIZE = 16

def pad(msg, block_size=BLOCK_SIZE, padding_char=PADDING_CHAR):
    return msg + ((block_size - len(msg) % block_size) * padding_char)

def unpad(msg, padding_char=PADDING_CHAR):
    return msg.rstrip(padding_char)

def encrypt(msg, key=constants.FLASK_SECRET_KEY):
    cipher = AES.new(key)
    ciphertext = cipher.encrypt(pad(msg))
    return base64.urlsafe_b64encode(ciphertext)

def decrypt(msg, key=constants.FLASK_SECRET_KEY):
    cipher = AES.new(key)
    ciphertext = base64.urlsafe_b64decode(msg)
    return unpad(cipher.decrypt(ciphertext))

def encrypt_with_salt(msg, key=constants.FLASK_SECRET_KEY):
    salt = Random.get_random_bytes(SALT_SIZE)
    msg_with_salt = '%s%s' % (salt, msg)
    return encrypt(msg_with_salt, key)

def decrypt_with_salt(msg, key=constants.FLASK_SECRET_KEY):
    msg_with_salt = decrypt(msg, key)
    return msg_with_salt[SALT_SIZE:]
