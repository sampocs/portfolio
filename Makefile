VENV_NAME=portfolio

install:
	conda create --name $(VENV_NAME) python=3.11 -y
	$(PYTHON) -m pip install -r backend/requirements-dev.txt
