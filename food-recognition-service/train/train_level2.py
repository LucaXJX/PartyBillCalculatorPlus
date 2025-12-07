"""
第二層模型訓練：菜系分類（多分類：中餐、日餐、韓餐、西餐等）
"""
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks
from tensorflow.keras.applications import MobileNetV2
from pathlib import Path
import json
import numpy as np

# 設置 GPU 內存增長
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    except RuntimeError as e:
        print(e)

def build_cuisine_classification_model(input_shape=(224, 224, 3), num_classes=4):
    """
    構建菜系分類模型
    
    Args:
        input_shape: 輸入圖像形狀
        num_classes: 分類數量（例如：中餐、日餐、韓餐、西餐）
        
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
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation='softmax')  # 多分類
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

def train_level2():
    """訓練第二層模型"""
    print("[INFO] 開始訓練第二層模型：菜系分類")
    
    # 獲取項目根目錄
    script_dir = Path(__file__).resolve().parent  # train/
    service_dir = script_dir.parent  # food-recognition-service/
    project_root = service_dir.parent  # PartyBillCalculator/
    data_dir = project_root / 'data' / 'level2-country-classification'
    model_dir = project_root / 'models' / 'level2'
    model_dir.mkdir(parents=True, exist_ok=True)
    
    if not data_dir.exists():
        print(f"[ERROR] 數據目錄不存在: {data_dir}")
        return
    
    print("[INFO] 加載訓練數據...")
    train_gen, val_gen = load_data(str(data_dir))
    
    num_classes = len(train_gen.class_indices)
    print(f"分類數量: {num_classes}")
    print(f"類別: {train_gen.class_indices}")
    print(f"訓練樣本數: {train_gen.samples}")
    print(f"驗證樣本數: {val_gen.samples}")
    
    # 計算類別權重（處理數據不平衡）
    class_indices = train_gen.class_indices
    class_counts = {}
    for class_name, class_idx in class_indices.items():
        # 計算每個類別的樣本數
        class_dir = Path(data_dir) / class_name
        if class_dir.exists():
            files = list(class_dir.glob('*.jpg')) + list(class_dir.glob('*.jpeg'))
            class_counts[class_idx] = len(files)
    
    # 計算類別權重（樣本數越少，權重越大）
    total_samples = sum(class_counts.values())
    class_weights = {}
    print("[INFO] 類別數據分布和權重:")
    for class_name, class_idx in class_indices.items():
        count = class_counts.get(class_idx, 0)
        # 使用平衡權重：總樣本數 / (類別數 * 該類別樣本數)
        weight = total_samples / (num_classes * count) if count > 0 else 1.0
        class_weights[class_idx] = weight
        print(f"  {class_name}: {count} 張, 權重: {weight:.2f}")
    
    print("[INFO] 使用類別權重來平衡數據不平衡問題")
    
    # 保存類別映射
    with open(model_dir / 'class_indices.json', 'w') as f:
        json.dump(train_gen.class_indices, f, indent=2)
    
    print("[INFO] 構建模型...")
    model = build_cuisine_classification_model(num_classes=num_classes)
    model.summary()
    
    callbacks_list = [
        callbacks.ModelCheckpoint(
            str(model_dir / 'best_model.h5'),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        # 禁用早停機制，讓模型跑完所有 epoch
        # callbacks.EarlyStopping(
        #     monitor='val_accuracy',
        #     patience=5,
        #     restore_best_weights=True,
        #     verbose=1,
        #     min_delta=0.0005
        # ),
        callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,  # 如果验证损失3个epoch没有改善就降低学习率
            verbose=1,
            min_delta=0.0005
        )
    ]
    
    print("[INFO] 開始訓練...")
    print("[INFO] 已禁用早停機制，將訓練完所有 epoch")
    print(f"[INFO] 使用類別權重來平衡數據")
    # CPU 訓練配置：使用多線程加速數據加載
    history = model.fit(
        train_gen,
        epochs=50,  # 增加到50個epoch，因為數據量不足需要更多訓練
        validation_data=val_gen,
        callbacks=callbacks_list,
        class_weight=class_weights,  # 使用類別權重平衡數據
        workers=4,  # CPU 多線程數據加載
        use_multiprocessing=False,  # Windows 上建議設為 False
        verbose=1
    )
    
    # 訓練完成後，加載最佳模型（因為沒有早停機制自動恢復）
    best_model_path = model_dir / 'best_model.h5'
    if best_model_path.exists():
        print("[INFO] 加載最佳模型權重...")
        model.load_weights(str(best_model_path))
        print(f"[INFO] 已加載最佳模型（從 {best_model_path}）")
    
    print("[INFO] 保存最終模型...")
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
    
    print("[SUCCESS] 訓練完成！")
    print(f"模型保存在: {model_dir / 'final_model'}")

if __name__ == '__main__':
    train_level2()


