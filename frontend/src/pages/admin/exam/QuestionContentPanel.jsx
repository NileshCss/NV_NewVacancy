import React from 'react'
import QuestionEmptyState from './QuestionEmptyState'
import QuestionBankTopicView from './QuestionBankTopicView'

export default function QuestionContentPanel({
  selectedTopic,
  onOpenMobileDrawer,
  onAddQuestion,
  onEditQuestion,
  onBulkImport,
  onAiExtract
}) {
  if (!selectedTopic) {
    return (
      <QuestionEmptyState
        onBrowseClick={onOpenMobileDrawer}
      />
    )
  }

  return (
    <QuestionBankTopicView
      selectedTopic={selectedTopic}
      onAddQuestion={onAddQuestion}
      onEditQuestion={onEditQuestion}
      onBulkImport={onBulkImport}
      onAiExtract={onAiExtract}
    />
  )
}
