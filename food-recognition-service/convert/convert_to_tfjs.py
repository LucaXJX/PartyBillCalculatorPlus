"""
將訓練好的 TensorFlow 模型轉換為 TensorFlow.js 格式
"""
import os
import warnings
from pathlib import Path
import json
import subprocess
import sys

# 設置環境變量減少警告
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
warnings.filterwarnings('ignore')

def convert_model_to_tfjs(saved_model_path, output_path):
    """
    將 TensorFlow SavedModel 轉換為 TensorFlow.js 格式
    
    Args:
        saved_model_path: TensorFlow SavedModel 路徑
        output_path: TensorFlow.js 輸出路徑
    """
    print(f"🔄 轉換模型: {saved_model_path} -> {output_path}")
    
    # 確保輸出目錄存在
    Path(output_path).mkdir(parents=True, exist_ok=True)
    
    try:
        # 優先使用命令行工具（避免 decision forests 導入問題）
        cmd = [
            sys.executable, '-m', 'tensorflowjs.converters.tf_saved_model_conversion_v2',
            '--input_format=tf_saved_model',
            '--saved_model_tags=serve',
            '--output_format=tfjs_graph_model',
            f'--saved_model_dir={str(saved_model_path)}',
            f'--output_dir={str(output_path)}'
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"✅ 模型已轉換為 TensorFlow.js 格式: {output_path}")
            return True
        except subprocess.CalledProcessError:
            # 如果命令行失敗，嘗試 Python API
            print("  命令行轉換失敗，嘗試 Python API...")
            import tensorflowjs as tfjs
            tfjs.converters.convert_saved_model(
                saved_model_dir=str(saved_model_path),
                output_dir=str(output_path)
            )
            print(f"✅ 模型已轉換為 TensorFlow.js 格式: {output_path}")
            return True
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

def convert_all_models():
    """轉換所有三層模型"""
    base_dir = Path(__file__).parent.parent
    models_dir = base_dir / 'models'
    output_dir = base_dir / 'models_tfjs'
    
    # 創建輸出目錄
    output_dir.mkdir(parents=True, exist_ok=True)
    
    models_to_convert = [
        ('level1', '第一層：食物檢測'),
        ('level2', '第二層：菜系分類'),
        ('level3', '第三層：細粒度分類')
    ]
    
    results = {}
    
    for level, description in models_to_convert:
        if level == 'level3':
            # level3 需要處理每個國家的模型
            level3_dir = models_dir / 'level3'
            if not level3_dir.exists():
                print(f"⚠️  Level3 模型目錄不存在: {level3_dir}")
                results[level] = False
                continue
            
            # 查找所有國家目錄
            countries = [d.name for d in level3_dir.iterdir() if d.is_dir()]
            if not countries:
                print(f"⚠️  Level3 沒有找到國家模型目錄")
                results[level] = False
                continue
            
            print(f"\n📦 {description}")
            level3_success = True
            for country in countries:
                model_path = level3_dir / country / 'final_model'
                output_path = output_dir / 'level3' / country
                
                if not model_path.exists():
                    print(f"  ⚠️  {country} 模型不存在: {model_path}")
                    level3_success = False
                    continue
                
                print(f"  🔄 轉換 {country} 模型...")
                success = convert_model_to_tfjs(str(model_path), str(output_path))
                if not success:
                    level3_success = False
            
            results[level] = level3_success
        else:
            model_path = models_dir / level / 'final_model'
            output_path = output_dir / level
            
            if not model_path.exists():
                print(f"⚠️  模型不存在: {model_path}")
                results[level] = False
                continue
            
            print(f"\n📦 {description}")
            success = convert_model_to_tfjs(str(model_path), str(output_path))
            results[level] = success
    
    # 總結
    print("\n" + "="*50)
    print("轉換總結:")
    for level, success in results.items():
        status = "✅" if success else "❌"
        print(f"  {status} {level}")
    
    # 生成模型信息文件
    info = {
        'models': {
            level: {
                'path': f'models_tfjs/{level}/model.json',
                'converted': success
            }
            for level, success in results.items()
        }
    }
    
    with open(output_dir / 'models_info.json', 'w') as f:
        json.dump(info, f, indent=2)
    
    print(f"\n📄 模型信息已保存: {output_dir / 'models_info.json'}")

if __name__ == '__main__':
    convert_all_models()


