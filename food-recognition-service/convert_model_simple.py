"""
簡單的模型轉換腳本，避免 decision forests 和 jax 兼容性問題
"""
import os
import sys
import subprocess
from pathlib import Path
from types import ModuleType

# 設置環境變量
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['PYTHONWARNINGS'] = 'ignore'

# 創建假的 tensorflow_decision_forests 模塊（如果不存在）
if 'tensorflow_decision_forests' not in sys.modules:
    try:
        import tensorflow_decision_forests
    except (ImportError, ModuleNotFoundError):
        fake_module = ModuleType('tensorflow_decision_forests')
        fake_keras = ModuleType('tensorflow_decision_forests.keras')
        fake_module.keras = fake_keras
        sys.modules['tensorflow_decision_forests'] = fake_module
        sys.modules['tensorflow_decision_forests.keras'] = fake_keras

def convert_model(saved_model_dir, output_dir):
    """轉換模型"""
    saved_model_dir = Path(saved_model_dir)
    output_dir = Path(output_dir)
    
    if not saved_model_dir.exists():
        print(f"❌ 模型不存在: {saved_model_dir}")
        return False
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 使用 tensorflowjs_converter 命令行工具
    converter_cmd = None
    
    # 查找 converter
    venv_scripts = Path(sys.executable).parent
    converter_exe = venv_scripts / 'tensorflowjs_converter'
    if not converter_exe.exists():
        converter_exe = venv_scripts / 'Scripts' / 'tensorflowjs_converter.exe'
    if not converter_exe.exists():
        converter_exe = venv_scripts / 'tensorflowjs_converter.exe'
    
    if converter_exe.exists():
        converter_cmd = [str(converter_exe)]
    else:
        # 使用 Python 模塊
        converter_cmd = [sys.executable, '-m', 'tensorflowjs.converters.tf_saved_model_conversion_v2']
    
    cmd = converter_cmd + [
        '--input_format=tf_saved_model',
        '--saved_model_tags=serve',
        '--output_format=tfjs_graph_model',
        f'--saved_model_dir={str(saved_model_dir)}',
        f'--output_dir={str(output_dir)}'
    ]
    
    print(f"🔄 轉換: {saved_model_dir} -> {output_dir}")
    
    try:
        env = os.environ.copy()
        env['TF_CPP_MIN_LOG_LEVEL'] = '3'
        env['PYTHONWARNINGS'] = 'ignore'
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,  # 不拋出異常，我們自己檢查
            env=env
        )
        
        # 檢查是否生成了 model.json（即使有警告）
        if (output_dir / 'model.json').exists():
            print("✅ 模型轉換成功")
            return True
        
        # 如果有錯誤輸出，顯示（過濾掉 decision forests 警告）
        if result.stderr:
            error_lines = [
                line for line in result.stderr.split('\n')
                if 'decision_forests' not in line.lower()
                and 'inference.so' not in line.lower()
                and line.strip()
                and 'warning' not in line.lower()
            ]
            if error_lines:
                print(f"❌ 轉換失敗:")
                for line in error_lines[-3:]:  # 只顯示最後3行
                    print(f"   {line}")
        
        return False
        
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法: python convert_model_simple.py <saved_model_dir> <output_dir>")
        sys.exit(1)
    
    success = convert_model(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)

