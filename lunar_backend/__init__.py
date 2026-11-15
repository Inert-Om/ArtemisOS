import os
import sys
from flask import Flask, send_from_directory
from flask_cors import CORS

def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

def create_app():
    dist_folder = get_resource_path("frontend/dist")
    
    # You can safely keep instance_relative_config=True here!
    app = Flask(
        __name__, 
        static_folder=dist_folder, 
        static_url_path="", 
        instance_relative_config=True
    )
    CORS(app)

    # Ensure the instance folder exists dynamically
    os.makedirs(app.instance_path, exist_ok=True)

    # Register blueprints (like your routes.py)
    from . import routes
    app.register_blueprint(routes.bp)

    # Serve the React frontend main page
    @app.route("/")
    def serve_react():
        return send_from_directory(app.static_folder, "index.html")

    return app