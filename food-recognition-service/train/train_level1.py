"""
第一層模型訓練：食物檢測（二分類：是食物/不是食物）
"""
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks
from tensorflow.keras.applications import MobileNetV2
import numpy as np
from pathlib import Path
import os

# 設置 GPU 內存增長（如果使用 GPU）
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    except RuntimeError as e:
        print(e)

def build_food_detection_model(input_shape=(224, 224, 3)):
    """
    構建食物檢測模型
    
    Args:
        input_shape: 輸入圖像形狀
        
    Returns:
        編譯好的模型
    """
    # 使用 MobileNetV2 作為基礎模型（遷移學習）
    base_model = MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )
    
    # 凍結基礎模型（可選：先凍結訓練分類層，然後解凍微調）
    base_model.trainable = False
    
    # 構建完整模型
    model = keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(1, activation='sigmoid')  # 二分類：是食物(1) / 不是食物(0)
    ])
    
    # 編譯模型
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.Precision(name='precision'), keras.metrics.Recall(name='recall')]
    )
    
    return model

def load_data(data_dir):
    """
    加載訓練數據
    
    Args:
        data_dir: 數據目錄路徑
        
    Returns:
        (train_dataset, val_dataset, test_dataset)
    """
    # TODO: 實現數據加載邏輯
    # 數據結構：
    # data_dir/
    #   ├── food/          # 食物圖片
    #   └── non_food/      # 非食物圖片
    
    # 使用 ImageDataGenerator 進行數據加載和增強
    train_datagen = keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        validation_split=0.2
    )
    
    train_generator = train_datagen.flow_from_directory(
        data_dir,
        target_size=(224, 224),
        batch_size=32,
        class_mode='binary',
        subset='training'
    )
    
    val_generator = train_datagen.flow_from_directory(
        data_dir,
        target_size=(224, 224),
        batch_size=32,
        class_mode='binary',
        subset='validation'
    )
    
    return train_generator, val_generator

def train_level1():
    """訓練第一層模型"""
    print("[INFO] 開始訓練第一層模型：食物檢測")
    
    # 設置路徑
    # 獲取項目根目錄（food-recognition-service 的父目錄）
    # __file__ 是 train/train_level1.py，所以需要向上兩級到項目根目錄
    script_dir = Path(__file__).resolve().parent  # train/
    service_dir = script_dir.parent  # food-recognition-service/
    project_root = service_dir.parent  # PartyBillCalculator/
    data_dir = project_root / 'data' / 'level1-food-detection'  # 數據目錄
    model_dir = project_root / 'models' / 'level1'
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # 檢查數據目錄
    if not data_dir.exists():
        print(f"[ERROR] 數據目錄不存在: {data_dir}")
        print("請先準備訓練數據")
        return

    # 加載數據
    print("[INFO] 加載訓練數據...")
    train_gen, val_gen = load_data(str(data_dir))

    print(f"訓練樣本數: {train_gen.samples}")
    print(f"驗證樣本數: {val_gen.samples}")

    # 構建模型
    print("[INFO] 構建模型...")
    model = build_food_detection_model()
    model.summary()

    # 定義回調
    callbacks_list = [
        callbacks.ModelCheckpoint(
            str(model_dir / 'best_model.h5'),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=3,  # 如果验证准确率3个epoch没有提升就停止
            restore_best_weights=True,
            verbose=1,
            min_delta=0.001  # 最小改善阈值
        ),
        callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=2,  # 如果验证损失2个epoch没有改善就降低学习率
            verbose=1,
            min_delta=0.001
        )
    ]

    # 訓練模型（CPU 優化配置）
    print("[INFO] 開始訓練...")
    print("[INFO] 使用早停機制：如果驗證準確率3個epoch沒有提升，將自動停止訓練")
    # CPU 訓練配置：使用多線程加速數據加載
    history = model.fit(
        train_gen,
        epochs=20,  # 減少到20個epoch，因為有早停機制
        validation_data=val_gen,
        callbacks=callbacks_list,
        workers=4,  # CPU 多線程數據加載
        use_multiprocessing=False,  # Windows 上建議設為 False
        verbose=1
    )

    # 保存最終模型
    print("[INFO] 保存模型...")
    model.save(str(model_dir / 'final_model'))

    # 保存訓練歷史（轉換 numpy 類型為 Python 原生類型）
    import json
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

    print("[SUCCESS] 訓練完成！")
    print(f"模型保存在: {model_dir / 'final_model'}")
    
    return model

if __name__ == '__main__':
    train_level1()


