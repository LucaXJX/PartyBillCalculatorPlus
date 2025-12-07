"""
模型轉換腳本，在子進程中注入假模塊
"""
import os
import sys
import subprocess
from pathlib import Path

def convert_model(saved_model_dir, output_dir):
    """轉換模型，在子進程中注入假模塊"""
    saved_model_dir = Path(saved_model_dir)
    output_dir = Path(output_dir)
    
    if not saved_model_dir.exists():
        print(f"ERROR: Model not found: {saved_model_dir}")
        return False
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 創建一個臨時 Python 腳本，在導入前注入假模塊
    temp_script = output_dir.parent / '_temp_convert_with_fake.py'
    
    script_content = f'''
import sys
from types import ModuleType

# 在導入 tensorflowjs 之前注入假模塊
if 'tensorflow_decision_forests' not in sys.modules:
    try:
        import tensorflow_decision_forests
    except (ImportError, ModuleNotFoundError):
        fake_module = ModuleType('tensorflow_decision_forests')
        fake_keras = ModuleType('tensorflow_decision_forests.keras')
        fake_module.keras = fake_keras
        sys.modules['tensorflow_decision_forests'] = fake_module
        sys.modules['tensorflow_decision_forests.keras'] = fake_keras

# 設置環境變量
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['PYTHONWARNINGS'] = 'ignore'

# 現在可以安全導入
try:
    from tensorflowjs.converters import tf_saved_model_conversion_v2
    
    # 轉換模型
    tf_saved_model_conversion_v2.convert_tf_saved_model(
        input_path=r'{str(saved_model_dir)}',
        output_dir=r'{str(output_dir)}',
        input_format='tf_saved_model',
        saved_model_tags='serve',
        output_format='tfjs_graph_model'
    )
    print("SUCCESS")
except Exception as e:
    # 如果還有 jax 問題，嘗試直接使用 converter
    if 'jax' in str(e).lower() or 'shape_poly' in str(e).lower():
        try:
            from tensorflowjs.converters.converter import convert
            convert(
                input_format='tf_saved_model',
                output_format='tfjs_graph_model',
                saved_model_dir=r'{str(saved_model_dir)}',
                output_dir=r'{str(output_dir)}'
            )
            print("SUCCESS")
        except Exception as e2:
            print(f"ERROR: {{e2}}")
            sys.exit(1)
    else:
        print(f"ERROR: {{e}}")
        sys.exit(1)
'''
    
    with open(temp_script, 'w', encoding='utf-8') as f:
        f.write(script_content)
    
    try:
        env = os.environ.copy()
        env['TF_CPP_MIN_LOG_LEVEL'] = '3'
        env['PYTHONWARNINGS'] = 'ignore'
        
        result = subprocess.run(
            [sys.executable, str(temp_script)],
            capture_output=True,
            text=True,
            env=env
        )
        
        # 檢查是否成功
        if 'SUCCESS' in result.stdout or (output_dir / 'model.json').exists():
            print("SUCCESS: Model converted")
            temp_script.unlink()
            return True
        else:
            if result.stderr:
                error = result.stderr.split('\n')[-5:]
                print("ERROR: Conversion failed")
                for line in error:
                    if line.strip():
                        print(f"   {line[:150]}")
            temp_script.unlink()
            return False
            
    except Exception as e:
        if temp_script.exists():
            temp_script.unlink()
        print(f"ERROR: Conversion failed: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python convert_with_fake_modules.py <saved_model_dir> <output_dir>")
        sys.exit(1)
    
    success = convert_model(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)

