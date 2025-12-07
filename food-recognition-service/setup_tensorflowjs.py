"""
Setup script to install tensorflowjs without tensorflow-decision-forests dependency
"""
import subprocess
import sys
import os

def setup_tensorflowjs():
    """Install tensorflowjs and create fake decision_forests module"""
    print("Installing tensorflowjs without dependencies...")
    subprocess.check_call([
        sys.executable, "-m", "pip", "install", 
        "tensorflowjs==4.13.0", "--no-deps"
    ])
    
    print("Installing required dependencies...")
    subprocess.check_call([
        sys.executable, "-m", "pip", "install",
        "packaging", "six"
    ])
    
    # Create fake_decision_forests.py if it doesn't exist
    fake_module_path = os.path.join(os.path.dirname(__file__), "fake_decision_forests.py")
    if not os.path.exists(fake_module_path):
        with open(fake_module_path, "w", encoding="utf-8") as f:
            f.write('''"""
Fake tensorflow_decision_forests module to bypass import errors
"""
import sys
import types

fake_module = types.ModuleType('tensorflow_decision_forests')
sys.modules['tensorflow_decision_forests'] = fake_module
''')
        print("Created fake_decision_forests.py")
    
    print("Setup complete!")
    print("Note: When using tensorflowjs, make sure to import fake_decision_forests first")

if __name__ == "__main__":
    setup_tensorflowjs()


