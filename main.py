"""`main` is the top level module for your Flask application."""

# Import the Flask Framework
from flask import Flask, g
import pymongo
from bson.son import SON
import json
from werkzeug.routing import FloatConverter as BaseFloatConverter
from flask import Response
from functools import wraps

def returns_json(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        r = f(*args, **kwargs)
        return Response(r, content_type='text/json')
    return decorated_function

# Workaround a bug in the float conversion
class FloatConverter(BaseFloatConverter):
    regex = r'-?\d+(\.\d+)?'

app = Flask(__name__)
# Note: We don't need to call run() since our application is embedded within
# the App Engine WSGI application server.
app.url_map.converters['float'] = FloatConverter

app.config.update(dict(
    MONGO_DB_HOST='127.0.0.1',
    MONGO_DB_PORT=27017,
    MONGO_DB_NAME='wikip',
    MONGO_DB_COLL='points'
))

def connect_mongo_db():
    mongo_client = pymongo.MongoClient(app.config['MONGO_DB_HOST'], app.config['MONGO_DB_PORT'])
    return mongo_client[app.config['MONGO_DB_NAME']]

def mongodb():
    """Opens a new database connection if there is none yet for the
    current application context.
    """
    if not hasattr(g, 'mongodb'):
        g.mongodb = connect_mongo_db()
    return g.mongodb

def coll_name():
    return app.config['MONGO_DB_COLL']

@app.route('/')
def hello():
    """Return a friendly HTTP greeting."""
    return 'Hello World!'

@app.route('/near/<float:lat>/<float:lon>')
@returns_json
def near(lat, lon):
    results = mongodb().command(SON([('geoNear', coll_name()), ('near', [lon, lat]), ('spherical', True)]))['results']
    for r in results:
        r['obj']['_id'] = repr(r['obj']['_id'])
    return json.dumps(results)

@app.errorhandler(404)
def page_not_found(e):
    """Return a custom 404 error."""
    return 'FOO Sorry, Nothing at this URL.', 404
