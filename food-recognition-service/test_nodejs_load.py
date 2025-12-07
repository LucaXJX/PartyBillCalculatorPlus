"""
測試 Node.js 模型加載
驗證轉換後的 TensorFlow.js 模型是否可以被正確加載
"""

import json
from pathlib import Path

def test_model_structure(model_dir: Path):
    """
    檢查 TensorFlow.js 模型結構
    
    Args:
        model_dir: TensorFlow.js 模型目錄
    """
    print(f"🔍 檢查模型結構: {model_dir}")
    
    if not model_dir.exists():
        print(f"❌ 模型目錄不存在: {model_dir}")
        return False
    
    model_json = model_dir / 'model.json'
    if not model_json.exists():
        print(f"❌ model.json 不存在: {model_json}")
        return False
    
    # 讀取 model.json
    try:
        with open(model_json, 'r') as f:
            model_info = json.load(f)
        
        print("✅ model.json 格式正確")
        print(f"   模型格式版本: {model_info.get('formatVersion', 'unknown')}")
        print(f"   權重數量: {len(model_info.get('weightsManifest', []))}")
        
        # 檢查權重文件
        weights_manifest = model_info.get('weightsManifest', [])
        if weights_manifest:
            for i, manifest in enumerate(weights_manifest):
                paths = manifest.get('paths', [])
                print(f"   權重文件組 {i+1}: {len(paths)} 個文件")
                for path in paths[:3]:  # 只顯示前3個
                    weight_file = model_dir / path
                    if weight_file.exists():
                        size = weight_file.stat().st_size / 1024 / 1024  # MB
                        print(f"     ✅ {path} ({size:.2f} MB)")
                    else:
                        print(f"     ❌ {path} (不存在)")
        
        return True
    except json.JSONDecodeError as e:
        print(f"❌ model.json 格式錯誤: {e}")
        return False
    except Exception as e:
        print(f"❌ 檢查失敗: {e}")
        return False

def main():
    """主測試流程"""
    print("="*60)
    print("🧪 Node.js 模型加載測試")
    print("="*60)
    
    base_dir = Path(__file__).parent
    test_output_dir = base_dir / 'test_models_tfjs' / 'level1'
    
    if not test_output_dir.exists():
        print(f"❌ 測試模型目錄不存在: {test_output_dir}")
        print("   請先運行 test_training.py 生成測試模型")
        return False
    
    success = test_model_structure(test_output_dir)
    
    if success:
        print("\n✅ 模型結構檢查通過")
        print("\n💡 下一步：")
        print("   在 Node.js 中測試模型加載：")
        print("   node --loader ts-node/esm scripts/test-model-load.ts")
    else:
        print("\n❌ 模型結構檢查失敗")
    
    return success

if __name__ == '__main__':
    main()

