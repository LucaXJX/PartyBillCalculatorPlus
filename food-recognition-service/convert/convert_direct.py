"""
直接使用 Python API 轉換模型（繞過命令行工具的依賴問題）
"""
import os
import sys
import warnings
from pathlib import Path
import json
import types

# 修復 Windows 控制台編碼問題
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 在導入 tensorflowjs 之前，注入假的模塊來繞過導入錯誤
# 創建假的 decision_forests 模塊
fake_decision_forests = types.ModuleType('tensorflow_decision_forests')
fake_decision_forests.__version__ = "1.8.1"
sys.modules['tensorflow_decision_forests'] = fake_decision_forests

# 修復 jax 導入問題
try:
    import jax.experimental
    fake_jax2tf = types.ModuleType('jax.experimental.jax2tf')
    # 創建假的 shape_poly 模塊
    fake_shape_poly = types.ModuleType('jax.experimental.jax2tf.shape_poly')
    # 添加需要的類
    class FakePolyShape:
        pass
    fake_shape_poly.PolyShape = FakePolyShape
    fake_jax2tf.shape_poly = fake_shape_poly
    jax.experimental.jax2tf = fake_jax2tf
    sys.modules['jax.experimental.jax2tf'] = fake_jax2tf
    sys.modules['jax.experimental.jax2tf.shape_poly'] = fake_shape_poly
except Exception as e:
    print(f"警告: 無法修復 jax 導入: {e}")

# 設置環境變量減少警告
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
warnings.filterwarnings('ignore')

def convert_h5_to_tfjs_direct(h5_path, output_path):
    """
    直接使用 TensorFlow.js Python API 轉換 H5 模型
    """
    print(f"🔄 直接轉換 H5 模型: {h5_path} -> {output_path}")
    
    try:
        import tensorflow as tf
        import tensorflowjs as tfjs
        
        # 確保輸出目錄存在
        Path(output_path).mkdir(parents=True, exist_ok=True)
        
        # 方法 1: 直接使用 tfjs.converters.save_keras_model
        print("  嘗試方法 1: 直接轉換 H5 模型...")
        try:
            # 加載 Keras 模型
            model = tf.keras.models.load_model(h5_path)
            print(f"  ✅ 模型已加載: {model.summary() if hasattr(model, 'summary') else 'N/A'}")
            
            # 轉換為 TensorFlow.js 格式
            tfjs.converters.save_keras_model(model, output_path)
            print(f"✅ H5 模型已轉換為 TensorFlow.js 格式: {output_path}")
            return True
        except Exception as e1:
            print(f"  方法 1 失敗: {e1}")
            print("  嘗試方法 2: 先轉換為 SavedModel...")
            
            # 方法 2: 先保存為 SavedModel，再轉換
            try:
                # 加載模型
                model = tf.keras.models.load_model(h5_path)
                
                # 保存為 SavedModel
                temp_saved_model = str(Path(output_path).parent / f"_temp_saved_model_{Path(h5_path).stem}")
                model.save(temp_saved_model, save_format='tf')
                print(f"  ✅ 模型已保存為 SavedModel: {temp_saved_model}")
                
                # 轉換 SavedModel 為 TensorFlow.js
                tfjs.converters.convert_saved_model(
                    saved_model_dir=temp_saved_model,
                    output_dir=output_path
                )
                print(f"✅ H5 模型已轉換為 TensorFlow.js 格式: {output_path}")
                
                # 清理臨時文件
                import shutil
                if Path(temp_saved_model).exists():
                    shutil.rmtree(temp_saved_model)
                
                return True
            except Exception as e2:
                print(f"  方法 2 也失敗: {e2}")
                return False
                
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

def convert_savedmodel_to_tfjs_direct(saved_model_path, output_path):
    """
    直接使用 TensorFlow.js Python API 轉換 SavedModel
    """
    print(f"🔄 直接轉換 SavedModel: {saved_model_path} -> {output_path}")
    
    try:
        import tensorflow as tf
        import tensorflowjs as tfjs
        
        # 確保輸出目錄存在
        Path(output_path).mkdir(parents=True, exist_ok=True)
        
        # 方法 1: 嘗試使用 tf_saved_model_conversion_v2
        try:
            from tensorflowjs.converters import tf_saved_model_conversion_v2
            tf_saved_model_conversion_v2.convert_tf_saved_model(
                saved_model_dir=str(saved_model_path),
                output_dir=str(output_path),
                saved_model_tags='serve'
            )
            print(f"✅ SavedModel 已轉換為 TensorFlow.js 格式: {output_path}")
            return True
        except Exception as e1:
            print(f"  方法 1 失敗: {e1}")
            print("  嘗試方法 2: 先加載為 Keras 模型...")
            
            # 方法 2: 先加載為 Keras 模型，再轉換
            try:
                # 加載 SavedModel
                model = tf.keras.models.load_model(str(saved_model_path))
                print(f"  ✅ 模型已加載")
                
                # 轉換為 TensorFlow.js
                tfjs.converters.save_keras_model(model, str(output_path))
                print(f"✅ SavedModel 已轉換為 TensorFlow.js 格式: {output_path}")
                return True
            except Exception as e2:
                print(f"  方法 2 也失敗: {e2}")
                return False
                
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

def convert_all_models_direct():
    """直接轉換所有三層模型"""
    base_dir = Path(__file__).parent.parent.parent  # 回到 PartyBillCalculator 根目錄
    models_dir = base_dir / 'models'  # 使用實際的模型目錄
    output_dir = base_dir / 'food-recognition-service' / 'models_tfjs'
    
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
                h5_path = level3_dir / country / 'best_model.h5'
                output_path = output_dir / 'level3' / country
                
                print(f"  🔄 轉換 {country} 模型...")
                
                # 優先使用 SavedModel，否則使用 H5
                if model_path.exists():
                    success = convert_savedmodel_to_tfjs_direct(str(model_path), str(output_path))
                elif h5_path.exists():
                    success = convert_h5_to_tfjs_direct(str(h5_path), str(output_path))
                else:
                    print(f"  ⚠️  {country} 模型不存在: {model_path} 或 {h5_path}")
                    level3_success = False
                    continue
                
                if not success:
                    level3_success = False
            
            results[level] = level3_success
        else:
            model_path = models_dir / level / 'final_model'
            h5_path = models_dir / level / 'best_model.h5'
            output_path = output_dir / level
            
            print(f"\n📦 {description}")
            
            # 優先使用 SavedModel，否則使用 H5
            if model_path.exists():
                print(f"  找到 SavedModel 格式: {model_path}")
                success = convert_savedmodel_to_tfjs_direct(str(model_path), str(output_path))
            elif h5_path.exists():
                print(f"  找到 H5 格式: {h5_path}")
                success = convert_h5_to_tfjs_direct(str(h5_path), str(output_path))
            else:
                print(f"⚠️  模型不存在: {model_path} 或 {h5_path}")
                results[level] = False
                continue
            
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
    
    with open(output_dir / 'models_info.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2, ensure_ascii=False)
    
    print(f"\n📄 模型信息已保存: {output_dir / 'models_info.json'}")

if __name__ == '__main__':
    convert_all_models_direct()

