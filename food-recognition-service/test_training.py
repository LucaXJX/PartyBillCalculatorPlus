"""
Python 訓練功能測試腳本
使用小規模數據集進行快速測試，驗證訓練流程是否正常
不影響現有數據庫
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks
from tensorflow.keras.applications import MobileNetV2
from pathlib import Path
import numpy as np
import json
import shutil
import os

# 設置 GPU 內存增長（如果使用 GPU）
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        print("✅ GPU 已配置")
    except RuntimeError as e:
        print(f"⚠️  GPU 配置失敗: {e}")

def create_test_data(data_dir: Path, num_samples_per_class: int = 20):
    """
    創建小規模測試數據集
    
    Args:
        data_dir: 數據目錄
        num_samples_per_class: 每個類別的樣本數
    """
    print(f"📦 創建測試數據集: {data_dir}")
    
    # 創建目錄結構
    food_dir = data_dir / 'food'
    non_food_dir = data_dir / 'non_food'
    food_dir.mkdir(parents=True, exist_ok=True)
    non_food_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成隨機測試圖片（使用 TensorFlow 創建）
    print(f"  生成 {num_samples_per_class} 個食物樣本...")
    for i in range(num_samples_per_class):
        # 創建隨機 RGB 圖片 (224x224x3)
        img = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        
        # 使用 PIL 保存
        from PIL import Image
        img_pil = Image.fromarray(img)
        img_pil.save(food_dir / f'food_{i:04d}.jpg', 'JPEG')
    
    print(f"  生成 {num_samples_per_class} 個非食物樣本...")
    for i in range(num_samples_per_class):
        img = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        from PIL import Image
        img_pil = Image.fromarray(img)
        img_pil.save(non_food_dir / f'non_food_{i:04d}.jpg', 'JPEG')
    
    print(f"✅ 測試數據集已創建: {data_dir}")
    print(f"   食物樣本: {num_samples_per_class}")
    print(f"   非食物樣本: {num_samples_per_class}")

def build_test_model(input_shape=(224, 224, 3)):
    """構建測試模型（簡化版，用於快速測試）"""
    base_model = MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )
    base_model.trainable = False
    
    model = keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(64, activation='relu'),  # 減少參數以加快訓練
        layers.Dropout(0.5),
        layers.Dense(1, activation='sigmoid')
    ])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    return model

def test_training(data_dir: Path, model_dir: Path, epochs: int = 2):
    """
    測試訓練流程
    
    Args:
        data_dir: 數據目錄
        model_dir: 模型保存目錄
        epochs: 訓練輪數（測試時使用少量輪數）
    """
    print("\n" + "="*60)
    print("🧪 開始測試訓練流程")
    print("="*60)
    
    # 檢查數據
    if not data_dir.exists():
        print(f"❌ 數據目錄不存在: {data_dir}")
        return False
    
    # 加載數據
    print("\n📦 加載訓練數據...")
    train_datagen = keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        validation_split=0.2
    )
    
    train_gen = train_datagen.flow_from_directory(
        str(data_dir),
        target_size=(224, 224),
        batch_size=8,  # 小批量以加快測試
        class_mode='binary',
        subset='training'
    )
    
    val_gen = train_datagen.flow_from_directory(
        str(data_dir),
        target_size=(224, 224),
        batch_size=8,
        class_mode='binary',
        subset='validation'
    )
    
    print(f"  訓練樣本: {train_gen.samples}")
    print(f"  驗證樣本: {val_gen.samples}")
    
    if train_gen.samples == 0:
        print("❌ 沒有找到訓練樣本")
        return False
    
    # 構建模型
    print("\n🏗️  構建模型...")
    model = build_test_model()
    model.summary()
    
    # 訓練模型
    print(f"\n🎯 開始訓練（{epochs} 個 epoch）...")
    model_dir.mkdir(parents=True, exist_ok=True)
    
    history = model.fit(
        train_gen,
        epochs=epochs,
        validation_data=val_gen,
        verbose=1
    )
    
    # 保存模型
    print("\n💾 保存模型...")
    final_model_path = model_dir / 'final_model'
    model.save(str(final_model_path))
    
    # 保存訓練歷史
    history_path = model_dir / 'training_history.json'
    with open(history_path, 'w') as f:
        json.dump({k: [float(v) for v in values] for k, values in history.history.items()}, f, indent=2)
    
    print(f"✅ 模型已保存: {final_model_path}")
    print(f"✅ 訓練歷史已保存: {history_path}")
    
    # 驗證模型文件
    if not final_model_path.exists():
        print("❌ 模型文件不存在")
        return False
    
    # 檢查 SavedModel 結構
    saved_model_pb = final_model_path / 'saved_model.pb'
    if not saved_model_pb.exists():
        print("⚠️  警告: saved_model.pb 不存在，可能不是 SavedModel 格式")
    else:
        print("✅ SavedModel 格式正確")
    
    return True

def test_model_conversion(model_dir: Path, output_dir: Path):
    """
    測試模型轉換
    
    Args:
        model_dir: 原始模型目錄
        output_dir: TensorFlow.js 輸出路徑
    """
    print("\n" + "="*60)
    print("🔄 測試模型轉換")
    print("="*60)
    
    # 設置環境變量來跳過 decision forests（Windows 上可能缺少 native 庫）
    import os
    import sys
    from types import ModuleType
    
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # 減少警告
    
    # 如果 decision forests 不存在，創建一個假的模塊來滿足 tensorflowjs 的導入需求
    if 'tensorflow_decision_forests' not in sys.modules:
        try:
            import tensorflow_decision_forests
        except (ImportError, ModuleNotFoundError):
            # 創建假的模塊
            fake_module = ModuleType('tensorflow_decision_forests')
            fake_keras = ModuleType('tensorflow_decision_forests.keras')
            fake_module.keras = fake_keras
            sys.modules['tensorflow_decision_forests'] = fake_module
            sys.modules['tensorflow_decision_forests.keras'] = fake_keras
    
    try:
        # 嘗試延遲導入，避免 decision forests 問題
        import warnings
        warnings.filterwarnings('ignore')
        
        # 直接使用命令行工具而不是 Python API（更可靠）
        import subprocess
        
        model_path = model_dir / 'final_model'
        if not model_path.exists():
            print(f"❌ 模型不存在: {model_path}")
            return False
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"  轉換: {model_path} -> {output_dir}")
        print("  (使用 tensorflowjs_converter 命令行工具)")
        
        # 使用 tensorflowjs_converter 命令行工具
        cmd = [
            sys.executable, '-m', 'tensorflowjs.converters.tf_saved_model_conversion_v2',
            '--input_format=tf_saved_model',
            f'--saved_model_tags=serve',
            f'--output_format=tfjs_graph_model',
            f'--saved_model_dir={str(model_path)}',
            f'--output_dir={str(output_dir)}'
        ]
        
        try:
            # 設置環境變量減少警告
            env = os.environ.copy()
            env['TF_CPP_MIN_LOG_LEVEL'] = '3'
            env['PYTHONWARNINGS'] = 'ignore'
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=False, env=env)
            
            # 即使命令返回錯誤，也檢查是否生成了文件（decision forests 警告不影響轉換）
            model_json = output_dir / 'model.json'
            if model_json.exists():
                print("✅ 模型轉換成功")
                print(f"✅ TensorFlow.js 模型文件已生成: {model_json}")
                return True
            else:
                # 如果沒有生成文件，顯示錯誤（過濾掉 decision forests 警告）
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
                        for line in error_lines[-3:]:
                            print(f"   {line[:100]}")
                print("❌ model.json 不存在")
                return False
        except subprocess.CalledProcessError as e:
            # 即使有錯誤，也檢查是否生成了文件（decision forests 警告不影響轉換）
            model_json = output_dir / 'model.json'
            if model_json.exists():
                print("⚠️  轉換過程有警告，但模型文件已生成")
                print(f"✅ TensorFlow.js 模型文件: {model_json}")
                return True
            
            print(f"❌ 轉換失敗（命令行）")
            # 嘗試使用帶假模塊注入的轉換腳本
            print("  嘗試使用改進的轉換腳本（注入假模塊）...")
            try:
                convert_script = Path(__file__).parent / 'convert_with_fake_modules.py'
                if convert_script.exists():
                    result = subprocess.run(
                        [sys.executable, str(convert_script), str(model_path), str(output_dir)],
                        capture_output=True,
                        text=True,
                        env=env
                    )
                    if (output_dir / 'model.json').exists():
                        print("✅ 模型轉換成功（改進腳本）")
                        return True
                    elif result.stdout and 'SUCCESS' in result.stdout:
                        print("✅ 模型轉換成功（改進腳本）")
                        return True
                
                return False
            except Exception as e2:
                print(f"❌ 改進腳本也失敗: {e2}")
                return False
                
    except ImportError:
        print("❌ tensorflowjs 未安裝，請運行: pip install tensorflowjs")
        return False
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        import traceback
        traceback.print_exc()
        return False
    

def main():
    """主測試流程"""
    print("="*60)
    print("🧪 Python 訓練功能測試")
    print("="*60)
    print("\n此測試將：")
    print("1. 創建小規模測試數據集")
    print("2. 訓練一個簡化模型（少量 epoch）")
    print("3. 測試模型轉換為 TensorFlow.js")
    print("4. 驗證所有文件是否正確生成")
    print("\n⚠️  注意：此測試不會影響現有數據庫或生產數據")
    
    base_dir = Path(__file__).parent
    test_data_dir = base_dir / 'test_data' / 'level1'
    test_model_dir = base_dir / 'test_models' / 'level1'
    test_output_dir = base_dir / 'test_models_tfjs' / 'level1'
    
    # 清理舊的測試數據（可選）
    if test_data_dir.exists() and input("\n是否清理舊的測試數據？(y/N): ").lower() == 'y':
        print("🧹 清理舊測試數據...")
        if test_data_dir.exists():
            shutil.rmtree(test_data_dir)
        if test_model_dir.exists():
            shutil.rmtree(test_model_dir)
        if test_output_dir.exists():
            shutil.rmtree(test_output_dir)
    
    results = {
        'data_creation': False,
        'training': False,
        'conversion': False
    }
    
    # 步驟 1: 創建測試數據
    print("\n" + "="*60)
    print("步驟 1: 創建測試數據")
    print("="*60)
    try:
        create_test_data(test_data_dir, num_samples_per_class=20)
        results['data_creation'] = True
    except Exception as e:
        print(f"❌ 創建測試數據失敗: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 步驟 2: 測試訓練
    print("\n" + "="*60)
    print("步驟 2: 測試訓練")
    print("="*60)
    try:
        results['training'] = test_training(test_data_dir, test_model_dir, epochs=2)
    except Exception as e:
        print(f"❌ 訓練失敗: {e}")
        import traceback
        traceback.print_exc()
    
    # 步驟 3: 測試轉換
    if results['training']:
        print("\n" + "="*60)
        print("步驟 3: 測試模型轉換")
        print("="*60)
        try:
            results['conversion'] = test_model_conversion(test_model_dir, test_output_dir)
        except Exception as e:
            print(f"❌ 轉換失敗: {e}")
            import traceback
            traceback.print_exc()
    
    # 總結
    print("\n" + "="*60)
    print("📊 測試總結")
    print("="*60)
    for step, success in results.items():
        status = "✅" if success else "❌"
        step_name = {
            'data_creation': '數據創建',
            'training': '模型訓練',
            'conversion': '模型轉換'
        }.get(step, step)
        print(f"  {status} {step_name}")
    
    # 訓練成功是最重要的，轉換問題可以後續解決
    training_success = results['training'] and results['data_creation']
    conversion_success = results['conversion']
    all_passed = training_success and conversion_success
    
    if training_success:
        print("\n🎉 核心功能測試通過！Python 訓練流程正常工作。")
        print(f"\n📁 測試文件位置：")
        print(f"   數據: {test_data_dir}")
        print(f"   模型: {test_model_dir}")
        if conversion_success:
            print(f"   TensorFlow.js: {test_output_dir}")
        else:
            print(f"   TensorFlow.js: (轉換失敗，但模型已保存)")
        
        if not conversion_success:
            print("\n⚠️  模型轉換失敗（依賴兼容性問題）")
            print("💡 解決方案：")
            print("   1. 轉換問題不影響訓練功能，訓練已成功驗證")
            print("   2. 可以暫時跳過轉換測試，繼續進行數據庫 schema 工作")
            print("   3. 轉換可以在實際需要時再解決（使用其他轉換工具或更新依賴）")
            print("   4. 訓練好的模型（SavedModel 格式）可以直接使用")
        
        print("\n💡 下一步：")
        print("   1. 準備真實訓練數據")
        print("   2. 運行完整訓練腳本")
        if conversion_success:
            print("   3. 轉換模型並在 Node.js 中使用")
        else:
            print("   3. 轉換問題可以後續解決，不影響訓練功能")
    else:
        print("\n⚠️  核心功能測試失敗，請檢查錯誤信息。")
    
    return all_passed

if __name__ == '__main__':
    main()

