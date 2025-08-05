VENV_NAME=portfolio
CONDA_BASE := $(shell conda info --base)/envs
VENV_BIN=$(CONDA_BASE)/$(VENV_NAME)/bin
PYTHON=$(VENV_BIN)/python

install:
	conda create --name $(VENV_NAME) python=3.11 -y
	@$(PYTHON) -m pip install -r backend/requirements.txt

start-api:
	@$(PYTHON) -m uvicorn backend.main:app --host 0.0.0.0 --port 8000