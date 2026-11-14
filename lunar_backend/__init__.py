import os
from flask import Flask
from flask_cors import CORS

def create_app(test_config=None):
    # Create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    
    # Enable CORS so your React frontend (running on localhost:5173) can talk to Flask
    CORS(app)

    app.config.from_mapping(
        SECRET_KEY='dev',
    )

    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.path)
    except OSError:
        pass

    # Register Blueprints / Routes
    from . import routes
    app.register_blueprint(routes.bp)

    return app