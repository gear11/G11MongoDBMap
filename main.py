"""A Flask server that presents a REST interface to the MongoDB geoNear command."""
from flask import Flask, g, Response, send_from_directory
import pymongo
from pymongo.errors import ConnectionFailure
from bson.son import SON
import json
from werkzeug.routing import FloatConverter as BaseFloatConverter
from functools import wraps
import os

# Note: We don't need to call run() since our application is embedded within
# the App Engine WSGI application server.
app = Flask(__name__, static_folder='web')


# Workaround a bug in the float conversion
class FloatConverter(BaseFloatConverter):
    regex = r'-?\d+(\.\d+)?'
app.url_map.converters['float'] = FloatConverter

# App config params (use local MongoDB install on default port)
app.config.update(dict(
    MONGO_DB_HOST='127.0.0.1',
    MONGO_DB_PORT=27017,
    MONGO_DB_NAME='wikip',
    MONGO_DB_COLL='points',
    DIST_DIR=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
))


# Annotation to set content type to text/json
def returns_json(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        r = f(*args, **kwargs)
        print repr(r)
        (rsp, stat) = (r[0], r[1]) if isinstance(r, (tuple, list, set)) else (r, 200)
        return Response(rsp, content_type='text/json', status=stat)
    return decorated_function


def mongodb():
    """Opens a new database connection if there is none yet for the
    current application context."""
    if not hasattr(g, 'mongodb'):
        g.mongodb = connect_mongo_db()
    return g.mongodb


def connect_mongo_db():
    mongo_client = pymongo.MongoClient(app.config['MONGO_DB_HOST'], app.config['MONGO_DB_PORT'])
    return mongo_client[app.config['MONGO_DB_NAME']]


def coll_name():
    return app.config['MONGO_DB_COLL']


@app.route('/all/points/near/<float:lat>/<float:lon>')
@returns_json
def near(lat, lon):
    points = mongodb().command(SON([('geoNear', coll_name()), ('near', [lon, lat]), ('spherical', True)]))['results']
    rsp = {"points":  list(serialize_mongo_results(points))}
    return json.dumps(rsp)


@app.errorhandler(404)
def page_not_found(e):
    """Return a custom 404 error."""
    return 'Sorry, Nothing at this URL.', 404


@app.errorhandler(ValueError)
@returns_json
def handle_value_error(error):
    return json.dumps({"message": repr(error)}), 400


@app.errorhandler(ConnectionFailure)
@returns_json
def handle_connection_failure(error):
    return json.dumps({"message": repr(error)}), 500


# Custom static data--minified script
@app.route('/dist/g11-maps.min.js')
def g11_maps_js():
    return send_from_directory(app.config['DIST_DIR'], 'g11-maps.min.js')


# Utility methods
def serialize_mongo_results(results):
    for r in results:
        o = r['obj']
        o['dis'] = r['dis']
        o['_id'] = str(o['_id'])
        yield o