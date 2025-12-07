"""
第三層模型訓練：細粒度食物分類（按國家/菜系）
"""
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks
from tensorflow.keras.applications import MobileNetV2
from pathlib import Path
import json
import sys

# 設置 GPU 內存增長
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    except RuntimeError as e:
        print(e)

def build_fine_grained_model(input_shape=(224, 224, 3), num_classes=10):
    """
    構建細粒度分類模型
    
    Args:
        input_shape: 輸入圖像形狀
        num_classes: 分類數量
        
    Returns:
        編譯好的模型
    """
    base_model = MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )
    
    base_model.trainable = False
    
    model = keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(512, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy', 'top_k_categorical_accuracy']
    )
    
    return model

def load_data(data_dir):
    """加載訓練數據"""
    train_datagen = keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        zoom_range=0.2,
        fill_mode='nearest',
        validation_split=0.2
    )
    
    train_generator = train_datagen.flow_from_directory(
        data_dir,
        target_size=(224, 224),
        batch_size=32,
        class_mode='categorical',
        subset='training'
    )
    
    val_generator = train_datagen.flow_from_directory(
        data_dir,
        target_size=(224, 224),
        batch_size=32,
        class_mode='categorical',
        subset='validation'
    )
    
    return train_generator, val_generator

def train_level3(country='chinese'):
    """
    訓練第三層模型（按國家/菜系）
    
    Args:
        country: 國家/菜系名稱（如 'chinese', 'japanese'）
    """
    print(f"🚀 開始訓練第三層模型：{country} 細粒度分類")
    
    # 獲取項目根目錄
    script_dir = Path(__file__).resolve().parent  # train/
    service_dir = script_dir.parent  # food-recognition-service/
    project_root = service_dir.parent  # PartyBillCalculator/
    data_dir = project_root / 'data' / 'level3-fine-grained' / country
    model_dir = project_root / 'models' / 'level3' / country
    model_dir.mkdir(parents=True, exist_ok=True)
    
    if not data_dir.exists():
        print(f"❌ 數據目錄不存在: {data_dir}")
        print(f"請先準備 {country} 的訓練數據")
        return
    
    print("📦 加載訓練數據...")
    train_gen, val_gen = load_data(str(data_dir))
    
    num_classes = len(train_gen.class_indices)
    print(f"分類數量: {num_classes}")
    print(f"類別: {train_gen.class_indices}")
    print(f"訓練樣本數: {train_gen.samples}")
    print(f"驗證樣本數: {val_gen.samples}")
    
    # 保存類別映射
    with open(model_dir / 'class_indices.json', 'w') as f:
        json.dump(train_gen.class_indices, f, indent=2)
    
    print("🏗️  構建模型...")
    model = build_fine_grained_model(num_classes=num_classes)
    model.summary()
    
    callbacks_list = [
        callbacks.ModelCheckpoint(
            str(model_dir / 'best_model.h5'),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=5,  # 增加 patience 到 5，給模型更多時間收斂
            restore_best_weights=True,
            verbose=1,
            min_delta=0.0005  # 降低最小改善阈值，允許更小的改善
        ),
        callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,  # 增加 patience 到 3，避免過早降低學習率
            verbose=1,
            min_delta=0.0005  # 降低最小改善阈值
        )
    ]
    
    print("[INFO] 開始訓練...")
    print("[INFO] 使用早停機制：如果驗證準確率5個epoch沒有提升，將自動停止訓練")
    # CPU 訓練配置：使用多線程加速數據加載
    history = model.fit(
        train_gen,
        epochs=30,  # 增加到30個epoch，給模型更多訓練機會
        validation_data=val_gen,
        callbacks=callbacks_list,
        workers=4,  # CPU 多線程數據加載
        use_multiprocessing=False,  # Windows 上建議設為 False
        verbose=1
    )
    
    print("[INFO] 保存模型...")
    model.save(str(model_dir / 'final_model'))
    
    # 保存訓練歷史（轉換 numpy 類型為 Python 原生類型）
    import numpy as np
    def convert_to_serializable(obj):
        """將 numpy 類型轉換為 Python 原生類型"""
        if isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {key: convert_to_serializable(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [convert_to_serializable(item) for item in obj]
        return obj
    
    serializable_history = convert_to_serializable(history.history)
    with open(model_dir / 'training_history.json', 'w') as f:
        json.dump(serializable_history, f, indent=2)
    
    print("✅ 訓練完成！")
    print(f"模型保存在: {model_dir / 'final_model'}")

if __name__ == '__main__':
    # 可以通過命令行參數指定國家
    country = sys.argv[1] if len(sys.argv) > 1 else 'chinese'
    train_level3(country)


