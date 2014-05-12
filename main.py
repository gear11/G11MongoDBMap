"""`main` is the top level module for your Flask application."""

# Import the Flask Framework
from flask import Flask, g, send_from_directory
import pymongo
from bson.son import SON
import json
from werkzeug.routing import FloatConverter as BaseFloatConverter
from flask import Response
from functools import wraps
import os

def returns_json(f):
    """An annotation that causes the content-type of Flask endpoints to return text/json"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        r = f(*args, **kwargs)
        return Response(r, content_type='text/json')
    return decorated_function

class FloatConverter(BaseFloatConverter):
    """Flask float conversion doesn't handle negatives, so we need to fix it, oops!"""
    regex = r'-?\d+(\.\d+)?'

app = Flask(__name__, static_folder='web')
# Note: We don't need to call run() since our application is embedded within
# the App Engine WSGI application server.
app.url_map.converters['float'] = FloatConverter

app.config.update(dict(
    MONGO_DB_HOST='127.0.0.1',
    MONGO_DB_PORT=27017,
    MONGO_DB_NAME='wikip',
    MONGO_DB_COLL='points',
    DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
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
    """The MongoDB collection where our location data is stored"""
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
    return 'Sorry, Nothing at this URL.', 404

# Custom static data
@app.route('/dist/g11-maps.min.js')
def g11_maps_js():
    return send_from_directory(app.config['DIST_DIR'], 'g11-maps.min.js')