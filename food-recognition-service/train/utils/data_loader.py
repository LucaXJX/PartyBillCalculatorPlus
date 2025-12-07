"""
數據加載工具
"""
from pathlib import Path
from PIL import Image
import numpy as np
import tensorflow as tf
from tensorflow import keras

def load_image_dataset(data_dir, target_size=(224, 224), batch_size=32, validation_split=0.2):
    """
    加載圖像數據集
    
    Args:
        data_dir: 數據目錄
        target_size: 目標圖像大小
        batch_size: 批次大小
        validation_split: 驗證集比例
        
    Returns:
        (train_generator, val_generator, class_indices)
    """
    data_dir = Path(data_dir)
    
    if not data_dir.exists():
        raise ValueError(f"數據目錄不存在: {data_dir}")
    
    # 數據增強（訓練集）
    train_datagen = keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        rotation_range=30,
        width_shift_range=0.3,
        height_shift_range=0.3,
        horizontal_flip=True,
        zoom_range=0.2,
        brightness_range=[0.8, 1.2],
        validation_split=validation_split
    )
    
    # 僅縮放（驗證集）
    val_datagen = keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        validation_split=validation_split
    )
    
    train_generator = train_datagen.flow_from_directory(
        str(data_dir),
        target_size=target_size,
        batch_size=batch_size,
        class_mode='categorical',
        subset='training',
        shuffle=True
    )
    
    val_generator = val_datagen.flow_from_directory(
        str(data_dir),
        target_size=target_size,
        batch_size=batch_size,
        class_mode='categorical',
        subset='validation',
        shuffle=False
    )
    
    return train_generator, val_generator, train_generator.class_indices

def load_single_image(image_path, target_size=(224, 224)):
    """
    加載單張圖片用於推理
    
    Args:
        image_path: 圖片路徑
        target_size: 目標大小
        
    Returns:
        預處理後的圖片數組
    """
    img = Image.open(image_path)
    img = img.resize(target_size)
    img_array = np.array(img) / 255.0
    
    # 如果是灰度圖，轉換為 RGB
    if len(img_array.shape) == 2:
        img_array = np.stack([img_array] * 3, axis=-1)
    elif img_array.shape[2] == 4:
        img_array = img_array[:, :, :3]
    
    # 添加批次維度
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array


