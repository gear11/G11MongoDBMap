"""`main` is the top level module for your Flask application."""

# Import the Flask Framework
from flask import Flask, g, Response, send_from_directory, render_template
import pymongo
from bson.son import SON
import json
from werkzeug.routing import FloatConverter as BaseFloatConverter
from functools import wraps
import os
import re

RAD_DIVISOR = {
    "mi" : 3959,
    "km" : 6371,
    "m" : 6371 * 1000,
    "ft" : 3959 * 5280
}
DIST_EXPR = re.compile(r'(\d+)(mi|ft|km|m)')


def returns_json(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        r = f(*args, **kwargs)
        print repr(r)
        (rsp, stat) = (r[0], r[1]) if isinstance(r, (tuple, list, set)) else (r, 200)
        return Response(rsp, content_type='text/json', status=stat)
    return decorated_function

# Workaround a bug in the float conversion
class FloatConverter(BaseFloatConverter):
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
    return app.config['MONGO_DB_COLL']

@app.route('/')
def hello():
    """Return a friendly HTTP greeting."""
    return 'Hello World!'

@app.route('/all/<path:bounds>')
@app.route('/all/')
@returns_json
def all(bounds=None):
    if not bounds:
        return render_template('error.html', error="/all URI requires bounds"), 400
    results = [doc for doc in mongodb()[coll_name()].find(loc_query(bounds)).limit(100)]
    for doc in results:
        doc['_id'] = repr(doc['_id'])
    return json.dumps(results)

def rad(dist):
    m = DIST_EXPR.match(dist)
    if not m:
        raise ValueError("Unparseable distance: %s", dist)
    div = RAD_DIVISOR[m.group(2)]
    return float(m.group(1)) / div

def near_query(lat, lng, rad=None):
    q = { "loc" : { "$near" : { "$geometry" : { "type" : "Point" , "coordinates" : [ lng , lat ] } } } }
    if rad:
        q["loc"]["$near"]["$maxDistance"] = rad
    return q

def within_query(lat1, lng1, lat2, lng2):
    return { "loc" : { "$geoWithin" : { "$box" : [ [ lng1, lat1 ] ,[ lng2, lat2 ] ] } } }

def loc_query(bounds):
    parts = bounds.split('/')
    if parts[0] == "near":
        return near_query(float(parts[1]), float(parts[2]), rad(parts[3]) if len(parts) > 3 else None)
    elif parts[0] == "within":
        return near_query(*[float(p) for p in parts[1:]])
    else:
        raise ValueError("Unrecognized bounds type: %s" % parts[0])

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

@app.errorhandler(ValueError)
@returns_json
def handle_value_error(error):
    return json.dumps({ "message" : repr(error)}), 400

# Custom static data
@app.route('/dist/g11-maps.min.js')
def g11_maps_js():
    return send_from_directory(app.config['DIST_DIR'], 'g11-maps.min.js')