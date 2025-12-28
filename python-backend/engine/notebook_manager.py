"""
Notebook Manager - Handles .py and .ipynb file management for backtesting strategies

Provides:
- Create, read, update, delete strategy files
- Jupyter notebook support with cell execution
- File versioning and history
- Project management
"""

import os
import json
import uuid
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict


@dataclass
class FileInfo:
    """Information about a strategy file"""
    id: str
    name: str
    type: str  # 'file' or 'folder'
    extension: Optional[str]
    path: str
    created_at: str
    modified_at: str
    size: int
    content: Optional[str] = None


@dataclass
class NotebookCell:
    """A single cell in a Jupyter notebook"""
    cell_type: str  # 'code', 'markdown', 'raw'
    source: List[str]
    outputs: List[Any] = None
    execution_count: Optional[int] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.outputs is None:
            self.outputs = []
        if self.metadata is None:
            self.metadata = {}


@dataclass
class Notebook:
    """A Jupyter notebook"""
    cells: List[NotebookCell]
    metadata: Dict[str, Any]
    nbformat: int = 4
    nbformat_minor: int = 5


@dataclass
class Project:
    """A backtesting project"""
    id: str
    name: str
    description: str
    created_at: str
    modified_at: str
    files: List[str]  # List of file IDs


class NotebookManager:
    """
    Manages strategy files and Jupyter notebooks for the backtesting platform.
    
    Features:
    - Create and manage .py strategy files
    - Create and manage .ipynb Jupyter notebooks
    - Project organization
    - File history/versioning
    """

    def __init__(self, base_dir: str = "data/projects"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.projects_file = self.base_dir / "projects.json"
        self.projects: Dict[str, Project] = {}
        self._load_projects()

    def _load_projects(self):
        """Load projects from disk"""
        if self.projects_file.exists():
            try:
                with open(self.projects_file, 'r') as f:
                    data = json.load(f)
                    for pid, pdata in data.items():
                        self.projects[pid] = Project(**pdata)
            except Exception as e:
                print(f"Error loading projects: {e}")

    def _save_projects(self):
        """Save projects to disk"""
        try:
            data = {pid: asdict(p) for pid, p in self.projects.items()}
            with open(self.projects_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving projects: {e}")

    # ==================== PROJECT MANAGEMENT ====================

    def create_project(self, name: str, description: str = "") -> Project:
        """Create a new backtesting project"""
        project_id = str(uuid.uuid4())[:8]
        now = datetime.utcnow().isoformat()
        
        project = Project(
            id=project_id,
            name=name,
            description=description,
            created_at=now,
            modified_at=now,
            files=[],
        )
        
        # Create project directory
        project_dir = self.base_dir / project_id
        project_dir.mkdir(exist_ok=True)
        
        # Create default main.py file
        main_file = self._create_default_strategy(project_id)
        project.files.append(main_file.id)
        
        self.projects[project_id] = project
        self._save_projects()
        
        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        """Get a project by ID"""
        return self.projects.get(project_id)

    def list_projects(self) -> List[Project]:
        """List all projects"""
        return list(self.projects.values())

    def delete_project(self, project_id: str) -> bool:
        """Delete a project and all its files"""
        if project_id not in self.projects:
            return False
        
        # Delete project directory
        project_dir = self.base_dir / project_id
        if project_dir.exists():
            shutil.rmtree(project_dir)
        
        del self.projects[project_id]
        self._save_projects()
        return True

    def update_project(self, project_id: str, name: str = None, description: str = None) -> Optional[Project]:
        """Update project metadata"""
        if project_id not in self.projects:
            return None
        
        project = self.projects[project_id]
        if name:
            project.name = name
        if description:
            project.description = description
        project.modified_at = datetime.utcnow().isoformat()
        
        self._save_projects()
        return project

    # ==================== FILE MANAGEMENT ====================

    def create_file(
        self,
        project_id: str,
        name: str,
        file_type: str = "py",
        content: str = None,
    ) -> Optional[FileInfo]:
        """Create a new file in a project"""
        if project_id not in self.projects:
            return None
        
        file_id = str(uuid.uuid4())[:8]
        now = datetime.utcnow().isoformat()
        
        # Ensure proper extension
        if not name.endswith(f".{file_type}"):
            name = f"{name}.{file_type}"
        
        # Default content based on file type
        if content is None:
            if file_type == "py":
                content = self._get_default_strategy_code()
            elif file_type == "ipynb":
                content = self._get_default_notebook_json()
        
        # Save file
        project_dir = self.base_dir / project_id
        file_path = project_dir / name
        
        with open(file_path, 'w') as f:
            f.write(content)
        
        # Update project
        self.projects[project_id].files.append(file_id)
        self.projects[project_id].modified_at = now
        self._save_projects()
        
        return FileInfo(
            id=file_id,
            name=name,
            type='file',
            extension=file_type,
            path=str(file_path),
            created_at=now,
            modified_at=now,
            size=len(content),
            content=content,
        )

    def get_file(self, project_id: str, file_name: str) -> Optional[FileInfo]:
        """Get a file from a project"""
        project_dir = self.base_dir / project_id
        file_path = project_dir / file_name
        
        if not file_path.exists():
            return None
        
        stat = file_path.stat()
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        extension = file_path.suffix[1:] if file_path.suffix else None
        
        return FileInfo(
            id=file_name,  # Use filename as ID for simplicity
            name=file_name,
            type='file',
            extension=extension,
            path=str(file_path),
            created_at=datetime.fromtimestamp(stat.st_ctime).isoformat(),
            modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
            size=stat.st_size,
            content=content,
        )

    def update_file(self, project_id: str, file_name: str, content: str) -> Optional[FileInfo]:
        """Update file content"""
        project_dir = self.base_dir / project_id
        file_path = project_dir / file_name
        
        if not file_path.exists():
            return None
        
        with open(file_path, 'w') as f:
            f.write(content)
        
        return self.get_file(project_id, file_name)

    def delete_file(self, project_id: str, file_name: str) -> bool:
        """Delete a file from a project"""
        project_dir = self.base_dir / project_id
        file_path = project_dir / file_name
        
        if not file_path.exists():
            return False
        
        file_path.unlink()
        
        # Update project
        self.projects[project_id].modified_at = datetime.utcnow().isoformat()
        self._save_projects()
        
        return True

    def list_files(self, project_id: str) -> List[FileInfo]:
        """List all files in a project"""
        project_dir = self.base_dir / project_id
        
        if not project_dir.exists():
            return []
        
        files = []
        for file_path in project_dir.iterdir():
            if file_path.is_file():
                stat = file_path.stat()
                extension = file_path.suffix[1:] if file_path.suffix else None
                
                files.append(FileInfo(
                    id=file_path.name,
                    name=file_path.name,
                    type='file',
                    extension=extension,
                    path=str(file_path),
                    created_at=datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    size=stat.st_size,
                ))
        
        return files

    def rename_file(self, project_id: str, old_name: str, new_name: str) -> Optional[FileInfo]:
        """Rename a file"""
        project_dir = self.base_dir / project_id
        old_path = project_dir / old_name
        new_path = project_dir / new_name
        
        if not old_path.exists():
            return None
        
        if new_path.exists():
            return None  # Cannot overwrite existing file
        
        old_path.rename(new_path)
        return self.get_file(project_id, new_name)

    # ==================== NOTEBOOK OPERATIONS ====================

    def create_notebook(
        self,
        project_id: str,
        name: str,
        cells: List[Dict[str, Any]] = None,
    ) -> Optional[FileInfo]:
        """Create a new Jupyter notebook"""
        if not name.endswith('.ipynb'):
            name = f"{name}.ipynb"
        
        if cells is None:
            cells = [
                {
                    "cell_type": "markdown",
                    "source": ["# Research Notebook\n", "\n", "Use this notebook for strategy research and analysis."],
                    "metadata": {},
                },
                {
                    "cell_type": "code",
                    "source": [
                        "import pandas as pd\n",
                        "import numpy as np\n",
                        "import matplotlib.pyplot as plt\n",
                        "\n",
                        "# Your analysis code here"
                    ],
                    "execution_count": None,
                    "outputs": [],
                    "metadata": {},
                },
            ]
        
        notebook = {
            "cells": cells,
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3",
                    "language": "python",
                    "name": "python3"
                },
                "language_info": {
                    "name": "python",
                    "version": "3.10.0"
                }
            },
            "nbformat": 4,
            "nbformat_minor": 5
        }
        
        content = json.dumps(notebook, indent=2)
        return self.create_file(project_id, name, "ipynb", content)

    def get_notebook(self, project_id: str, file_name: str) -> Optional[Notebook]:
        """Get a notebook and parse it"""
        file_info = self.get_file(project_id, file_name)
        if not file_info or not file_info.content:
            return None
        
        try:
            data = json.loads(file_info.content)
            cells = [NotebookCell(**cell) for cell in data.get("cells", [])]
            return Notebook(
                cells=cells,
                metadata=data.get("metadata", {}),
                nbformat=data.get("nbformat", 4),
                nbformat_minor=data.get("nbformat_minor", 5),
            )
        except Exception as e:
            print(f"Error parsing notebook: {e}")
            return None

    def add_notebook_cell(
        self,
        project_id: str,
        file_name: str,
        cell_type: str = "code",
        source: List[str] = None,
        position: int = -1,
    ) -> Optional[Notebook]:
        """Add a cell to a notebook"""
        notebook = self.get_notebook(project_id, file_name)
        if not notebook:
            return None
        
        new_cell = NotebookCell(
            cell_type=cell_type,
            source=source or [""],
        )
        
        if position < 0 or position >= len(notebook.cells):
            notebook.cells.append(new_cell)
        else:
            notebook.cells.insert(position, new_cell)
        
        # Save updated notebook
        self._save_notebook(project_id, file_name, notebook)
        return notebook

    def update_notebook_cell(
        self,
        project_id: str,
        file_name: str,
        cell_index: int,
        source: List[str] = None,
        cell_type: str = None,
    ) -> Optional[Notebook]:
        """Update a cell in a notebook"""
        notebook = self.get_notebook(project_id, file_name)
        if not notebook or cell_index >= len(notebook.cells):
            return None
        
        if source is not None:
            notebook.cells[cell_index].source = source
        if cell_type is not None:
            notebook.cells[cell_index].cell_type = cell_type
        
        self._save_notebook(project_id, file_name, notebook)
        return notebook

    def delete_notebook_cell(
        self,
        project_id: str,
        file_name: str,
        cell_index: int,
    ) -> Optional[Notebook]:
        """Delete a cell from a notebook"""
        notebook = self.get_notebook(project_id, file_name)
        if not notebook or cell_index >= len(notebook.cells):
            return None
        
        del notebook.cells[cell_index]
        self._save_notebook(project_id, file_name, notebook)
        return notebook

    def _save_notebook(self, project_id: str, file_name: str, notebook: Notebook):
        """Save a notebook to disk"""
        data = {
            "cells": [asdict(cell) for cell in notebook.cells],
            "metadata": notebook.metadata,
            "nbformat": notebook.nbformat,
            "nbformat_minor": notebook.nbformat_minor,
        }
        content = json.dumps(data, indent=2)
        self.update_file(project_id, file_name, content)

    # ==================== HELPER METHODS ====================

    def _create_default_strategy(self, project_id: str) -> FileInfo:
        """Create a default main.py strategy file"""
        return self.create_file(
            project_id,
            "main.py",
            "py",
            self._get_default_strategy_code(),
        )

    def _get_default_strategy_code(self) -> str:
        """Get default strategy code template"""
        return '''"""
WagYu Quant Strategy Template
"""
from datetime import timedelta, datetime

class MyStrategy:
    """
    Example trading strategy using RSI indicator.
    
    Customize this template to build your own strategy.
    """
    
    def Initialize(self):
        """
        Initialize strategy parameters and settings.
        Called once at the start of the backtest.
        """
        self.SetStartDate(2023, 1, 1)
        self.SetEndDate(2024, 1, 1)
        self.SetCash(100000)
        
        # Strategy parameters
        self.symbol = "BTC/USDT"
        self.lookback = 14
        self.position = 0
    
    def OnData(self, data):
        """
        Process incoming market data and generate trading signals.
        
        Args:
            data: DataFrame with OHLCV data
            
        Returns:
            1 for buy signal, -1 for sell signal, 0 for no action
        """
        if len(data) < self.lookback:
            return 0
        
        # Calculate simple moving average
        sma = data['close'].rolling(self.lookback).mean().iloc[-1]
        current_price = data['close'].iloc[-1]
        
        # Generate signals
        if current_price > sma and self.position <= 0:
            self.position = 1
            self.Log(f"BUY signal at {current_price}")
            return 1
        elif current_price < sma and self.position > 0:
            self.position = 0
            self.Log(f"SELL signal at {current_price}")
            return -1
        
        return 0
    
    def Log(self, message):
        """Log a message during backtesting"""
        print(f"{datetime.now().isoformat()} : {message}")
'''

    def _get_default_notebook_json(self) -> str:
        """Get default notebook JSON"""
        notebook = {
            "cells": [
                {
                    "cell_type": "markdown",
                    "source": [
                        "# Research Notebook\\n",
                        "\\n",
                        "Use this notebook for strategy research and data analysis."
                    ],
                    "metadata": {}
                },
                {
                    "cell_type": "code",
                    "source": [
                        "import pandas as pd\\n",
                        "import numpy as np\\n",
                        "import matplotlib.pyplot as plt\\n",
                        "\\n",
                        "# Fetch historical data\\n",
                        "# data = fetch_ohlcv('BTC/USDT', '1h', limit=1000)"
                    ],
                    "execution_count": None,
                    "outputs": [],
                    "metadata": {}
                }
            ],
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3",
                    "language": "python",
                    "name": "python3"
                }
            },
            "nbformat": 4,
            "nbformat_minor": 5
        }
        return json.dumps(notebook, indent=2)


# Singleton instance
_notebook_manager: Optional[NotebookManager] = None


def get_notebook_manager() -> NotebookManager:
    """Get the notebook manager singleton"""
    global _notebook_manager
    if _notebook_manager is None:
        _notebook_manager = NotebookManager()
    return _notebook_manager

