#!/bin/bash

# Set the Python path
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Create cache directory if it doesn't exist
mkdir -p ./cache

# Install Playwright browsers if not already installed
python -m playwright install chromium

# Start the service
python main.py
