VENV_NAME=portfolio
CONDA_BASE := $(shell conda info --base)/envs
VENV_BIN=$(CONDA_BASE)/$(VENV_NAME)/bin
PYTHON=$(VENV_BIN)/python

install:
	conda create --name $(VENV_NAME) python=3.11 -y
	@$(PYTHON) -m pip install -r backend/requirements.txt

start-api:
	@$(PYTHON) -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

bootstrap:
	@$(PYTHON) -m backend.bootstrap.load

start-ibeam:
ifndef IBEAM_ACCOUNT
	$(error IBEAM_ACCOUNT environment variable is required)
endif
ifndef IBEAM_PASSWORD
	$(error IBEAM_PASSWORD environment variable is required)
endif
	@docker run --env IBEAM_ACCOUNT=$(IBEAM_ACCOUNT) --env IBEAM_PASSWORD=$(IBEAM_PASSWORD) -p 8000:5000 voyz/ibeam