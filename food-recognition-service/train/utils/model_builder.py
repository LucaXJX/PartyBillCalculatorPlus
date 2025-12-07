"""
模型構建工具
"""
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2, ResNet50, EfficientNetB0

def build_model_with_transfer_learning(
    base_model_name='mobilenetv2',
    input_shape=(224, 224, 3),
    num_classes=2,
    trainable_base=False,
    dropout_rate=0.5
):
    """
    使用遷移學習構建模型
    
    Args:
        base_model_name: 基礎模型名稱 ('mobilenetv2', 'resnet50', 'efficientnetb0')
        input_shape: 輸入形狀
        num_classes: 分類數量
        trainable_base: 是否訓練基礎模型
        dropout_rate: Dropout 比率
        
    Returns:
        編譯好的模型
    """
    # 選擇基礎模型
    if base_model_name == 'mobilenetv2':
        base_model = MobileNetV2(
            input_shape=input_shape,
            include_top=False,
            weights='imagenet'
        )
    elif base_model_name == 'resnet50':
        base_model = ResNet50(
            input_shape=input_shape,
            include_top=False,
            weights='imagenet'
        )
    elif base_model_name == 'efficientnetb0':
        base_model = EfficientNetB0(
            input_shape=input_shape,
            include_top=False,
            weights='imagenet'
        )
    else:
        raise ValueError(f"不支持的基礎模型: {base_model_name}")
    
    base_model.trainable = trainable_base
    
    # 構建完整模型
    model = keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(dropout_rate),
        layers.Dense(128, activation='relu'),
        layers.Dropout(dropout_rate * 0.6),
        layers.Dense(num_classes, activation='softmax' if num_classes > 2 else 'sigmoid')
    ])
    
    # 編譯模型
    loss = 'categorical_crossentropy' if num_classes > 2 else 'binary_crossentropy'
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss=loss,
        metrics=['accuracy']
    )
    
    return model


