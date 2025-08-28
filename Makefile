VENV_NAME=portfolio
CONDA_BASE := $(shell conda info --base)/envs
VENV_BIN=$(CONDA_BASE)/$(VENV_NAME)/bin
PYTHON=$(VENV_BIN)/python

install:
	conda create --name $(VENV_NAME) python=3.11 -y
	@$(PYTHON) -m pip install -r backend/requirements.txt

start-api:
	@(cd backend && $(PYTHON) -m uvicorn backend.main:app --host 0.0.0.0 --port 8000)

start-streamlit:
	@(cd frontend/desktop && python -m streamlit run main.py --server.headless true)

bootstrap:
	@(cd backend && $(PYTHON) -m backend.bootstrap.seed)

start-ibeam:
ifndef IBEAM_ACCOUNT
	$(error IBEAM_ACCOUNT environment variable is required)
endif
ifndef IBEAM_PASSWORD
	$(error IBEAM_PASSWORD environment variable is required)
endif
	@docker run --env IBEAM_ACCOUNT=$(IBEAM_ACCOUNT) --env IBEAM_PASSWORD=$(IBEAM_PASSWORD) -p 7000:5000 voyz/ibeam

pip-freeze:
	@pipreqs backend --force

copy-data:
	@rm -rf ../porfolio-data/prices/ ../porfolio-data/trades/
	@cp -r data/* ../portfolio-data/

build-app:
	@(cd frontend/mobile && eas build --platform ios)

deploy-app:
	@(cd frontend/mobile && eas submit --platform ios)