## G11 MongoDB Map

An example of using Google Maps to display data from MongoDB.  For background, see:
http://gear11.com/2014/05/mongodb-location-google-map/

This project is pase on the Flask skeleton for Google App Engine (https://github.com/GoogleCloudPlatform/appengine-python-flask-skeleton.git).

## Run Locally
1. Install the [App Engine Python SDK](https://developers.google.com/appengine/downloads).
See the README file for directions. You'll need python 2.7 and [pip 1.4 or later](http://www.pip-installer.org/en/latest/installing.html) installed too.

2. Clone this repo with

   ```
   git clone https://github.com/gear11/G11MongoDBMap.git
   ```
   
3. Install [Node.js](http://nodejs.org/) and ensure `npm` is in your path.
   On Windows, you can start the `Node.js command prompt`
   
4. Install JavaScript build dependencies

   ```
   cd G11MongoDBMap
   npm install -g gulp
   npm install
   ```

5. Install client-side JavaScript dependencies

   ```
   bower install
   ```
   
6. Install Python dependencies in the project's lib directory.
   Note: App Engine can only import libraries from inside your project directory.

   ```
   pip install -r requirements.txt -t lib
   ```
   
5. Start this project locally from the command line (or alternatively use the Google App Engine Launcher GUI):

   ```
   dev_appserver.py .
   
7. Build the project.  This command will go into a loop checking for modifications.

   ```
   gulp
   ```


Visit the application [http://localhost:8080](http://localhost:8080)

See [the development server documentation](https://developers.google.com/appengine/docs/python/tools/devserver)
for options when running dev_appserver.

## Deploy
To deploy the application:

1. Deploy a loaded MonogoDB to a pulic server and modify `main.py` to point to your MongoDB instance
1. Use the [Admin Console](https://appengine.google.com) to create a
   project/app id. (App id and project id are identical)
1. [Deploy the
   application](https://developers.google.com/appengine/docs/python/tools/uploadinganapp) with

   ```
   appcfg.py -A <your-project-id> --oauth2 update .
   ```
1. Congratulations!  Your application is now live at your-app-id.appspot.com


## Author
Gear 11 Software
