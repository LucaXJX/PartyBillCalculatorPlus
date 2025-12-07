"""
Fake tensorflow_decision_forests module to bypass import errors
This is a workaround for tensorflowjs requiring this module even though we don't use it
"""

class FakeModule:
    """Fake module to satisfy imports"""
    pass

# Create a fake module structure
import sys
import types

fake_module = types.ModuleType('tensorflow_decision_forests')
sys.modules['tensorflow_decision_forests'] = fake_module
