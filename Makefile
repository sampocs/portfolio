VENV_NAME=portfolio
CONDA_BASE := $(shell conda info --base)/envs
VENV_BIN=$(CONDA_BASE)/$(VENV_NAME)/bin
PYTHON=$(VENV_BIN)/python

install:
	conda create --name $(VENV_NAME) python=3.11 -y
	@$(PYTHON) -m pip install -r backend/requirements.txt
	
npm-install:
	@(cd frontend/mobile && npm install --legacy-peer-deps)

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

run-app:
	@(cd frontend/mobile && npm run ios)

# NOTE: Increment the app.json build number and version first
build-app:
	@(cd frontend/mobile && eas build --platform ios)

deploy-app:
	@(cd frontend/mobile && eas submit --platform ios)

add-prices:
ifndef ASSET
	$(error ASSET environment variable is required)
endif
	@(cd backend && $(PYTHON) -m backend.bootstrap.add_prices --asset $(ASSET))

contract-id:
ifndef ASSET
	$(error ASSET environment variable is required)
endif
	@(cd backend && $(PYTHON) -m backend.scrapers.ibkr --contract-id --asset $(ASSET))