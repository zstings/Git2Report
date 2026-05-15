const git_commit_history = `#!/bin/bash

# 1. 获取当前日期用于文件名 (格式: 2024-05-20)
CURRENT_DATE=$(date +"%Y-%m-%d")
RECORD_FILE="__REPORT_DIR__/\${CURRENT_DATE}-git_commit_history.txt"

# 2. 获取当前 Git 项目信息
PROJECT_PATH=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -n "$PROJECT_PATH" ]; then
    # 确保文件存在
    touch "$RECORD_FILE"

    # 3. 获取当前提交的详细信息
    # %H: hash, %ai: 完整时间, %s: 标题, %b: 描述内容
    HASH=$(git log -1 --pretty=format:"%H")
    DATE=$(git log -1 --pretty=format:"%ai")
    SUBJECT=$(git log -1 --pretty=format:"%s")
    BODY=$(git log -1 --pretty=format:"%b")

    # 拼接内容字段：标题(描述)
    if [ -n "$BODY" ]; then
        CONTENT="\${SUBJECT}(\${BODY})"
    else
        CONTENT="\${SUBJECT}"
    fi

    # 4. 核心逻辑：判断内容长度并决定是否记录 diff
    CONTENT_LENGTH=\${#CONTENT}
    DIFF_INFO="[已忽略]"

    if [ $CONTENT_LENGTH -lt 15 ]; then
        # 判定为无意义提交，抓取代码变更统计和具体 Patch
        # --no-color 确保存入文本的是纯文字，方便 AI 读取
        DIFF_INFO=$(git show --no-color --pretty="" --patch-with-stat HEAD)
    fi

    # 5. 格式化输出并追加到当日文件
    {
        echo "项目：$PROJECT_PATH"
        echo "hash：$HASH"
        echo "时间：$DATE"
        echo "内容：$CONTENT"
        echo "diff_start"
        echo "$DIFF_INFO"
        echo "diff_end"
        echo "------------------------"
    } >> "$RECORD_FILE"
fi`;
export default git_commit_history;



/**
 * 压缩版，后期如果diff记录实在太离谱可以使用
 * # 4a. 获取文件变更统计（AI 借此判断涉及的模块）
        STATS=$(git diff --name-status HEAD^ HEAD)
        
        # 4b. 获取极致压缩的变更摘要
        # -U0: 不要任何上下文行
        # grep -v: 去掉 diff 协议头部冗余行
        # head -n 30: 强制封顶，防止单次意外的大量代码变动撑爆日志
        SUMMARY=$(git diff -U0 --no-color HEAD^ HEAD | grep -E "^@@|^[+-]" | grep -vE "^(\\+\\+\\+|---|@@.*@@$)" | head -n 30)
        
        DIFF_INFO="【文件统计】\\n\$STATS\\n【改动片段摘要】\\n\$SUMMARY"
 */