"""
分析训练结果
"""
import json
from pathlib import Path

def analyze_training(history_path):
    """分析训练历史"""
    with open(history_path, 'r') as f:
        h = json.load(f)
    
    val_acc = h['val_accuracy']
    train_acc = h['accuracy']
    val_loss = h['val_loss']
    train_loss = h['loss']
    
    # 找到最佳 epoch
    best_idx = val_acc.index(max(val_acc))
    best_val_acc = max(val_acc)
    
    print("=" * 60)
    print("训练结果分析")
    print("=" * 60)
    
    print(f"\n最佳模型:")
    print(f"  Epoch: {best_idx + 1}")
    print(f"  验证准确率: {best_val_acc:.2%}")
    print(f"  训练准确率: {train_acc[best_idx]:.2%}")
    print(f"  验证损失: {val_loss[best_idx]:.4f}")
    print(f"  训练损失: {train_loss[best_idx]:.4f}")
    
    print(f"\n最终状态 (Epoch {len(val_acc)}):")
    print(f"  验证准确率: {val_acc[-1]:.2%}")
    print(f"  训练准确率: {train_acc[-1]:.2%}")
    print(f"  验证损失: {val_loss[-1]:.4f}")
    print(f"  训练损失: {train_loss[-1]:.4f}")
    
    # Top-k 准确率
    if 'val_top_k_categorical_accuracy' in h:
        top_k = h['val_top_k_categorical_accuracy']
        print(f"\nTop-3 准确率:")
        print(f"  最佳: {max(top_k):.2%} (Epoch {top_k.index(max(top_k)) + 1})")
        print(f"  最终: {top_k[-1]:.2%}")
        print(f"  提升空间: {max(top_k) - best_val_acc:.2%}")
    
    # 准确率趋势
    print(f"\n准确率趋势 (每10个epoch):")
    for i in range(0, len(val_acc), 10):
        end_idx = min(i + 9, len(val_acc) - 1)
        epoch_range = f"Epoch {i+1:2d}-{end_idx+1:2d}"
        start_acc = val_acc[i]
        end_acc = val_acc[end_idx]
        best_in_range = max(val_acc[i:end_idx+1])
        print(f"  {epoch_range}: {start_acc:.2%} -> {end_acc:.2%} (最佳: {best_in_range:.2%})")
    
    # 评估
    print(f"\n评估:")
    random_baseline = 1.0 / 9  # 9分类随机猜测
    improvement = best_val_acc - random_baseline
    print(f"  随机猜测基线: {random_baseline:.2%}")
    print(f"  相对随机猜测提升: {improvement:.2%} ({improvement/random_baseline:.1f}x)")
    
    if best_val_acc >= 0.70:
        print(f"  [GOOD] 准确率良好 (>=70%)")
    elif best_val_acc >= 0.60:
        print(f"  [WARNING] 准确率中等 (60-70%)，可能需要更多数据")
    else:
        print(f"  [POOR] 准确率偏低 (<60%)，建议增加数据量")
    
    # 过拟合检查
    overfit = train_acc[best_idx] - best_val_acc
    if overfit > 0.10:
        print(f"  [WARNING] 可能存在过拟合 (训练-验证差距: {overfit:.2%})")
    else:
        print(f"  [OK] 过拟合风险较低 (训练-验证差距: {overfit:.2%})")
    
    print("=" * 60)

if __name__ == '__main__':
    import sys
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    
    level2_history = project_root / 'models' / 'level2' / 'training_history.json'
    
    if level2_history.exists():
        print("第二层模型训练分析:\n")
        analyze_training(level2_history)
    else:
        print(f"训练历史文件不存在: {level2_history}")

