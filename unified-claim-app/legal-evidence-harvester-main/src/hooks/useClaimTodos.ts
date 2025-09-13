import { useMemo } from 'react';
import { TodoItem } from '@/types/todo';
import { Evidence } from '@/types/evidence';
import { Claim } from '@/hooks/useClaims';
import { getClaimColor } from '@/utils/claimColors';

export interface ClaimTodo extends TodoItem {
  claimIds: string[];
  claimColors: string[];
}

export const useClaimTodos = (todos: TodoItem[], evidence: Evidence[], claims: Claim[], selectedClaimId: string | null) => {
  const claimTodos = useMemo(() => {
    return todos.map(todo => {
      // Find evidence that links this todo to claims
      const linkedEvidence = evidence.find(e => {
        // Check if this todo was created from this evidence
        // We can match by description or ideally by evidenceId if available
        return todo.evidenceId === e.id;
      });

      const claimIds = linkedEvidence ? linkedEvidence.claimIds : [];
      const claimColors = claimIds.map(claimId => {
        const color = getClaimColor(claimId);
        return color.border.replace('border-', '');
      });

      return {
        ...todo,
        claimIds,
        claimColors
      } as ClaimTodo;
    });
  }, [todos, evidence, claims]);

  const sortedTodos = useMemo(() => {
    if (!selectedClaimId) return claimTodos;

    return [...claimTodos].sort((a, b) => {
      const aIsActive = a.claimIds.includes(selectedClaimId);
      const bIsActive = b.claimIds.includes(selectedClaimId);
      
      // Active claim todos first
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      // Within same priority group, sort by due date
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }, [claimTodos, selectedClaimId]);

  const getActiveClaimTodos = (date?: Date) => {
    if (!selectedClaimId) return [];
    
    const filtered = sortedTodos.filter(todo => 
      todo.claimIds.includes(selectedClaimId)
    );

    if (date) {
      return filtered.filter(todo => 
        todo.dueDate.toDateString() === date.toDateString()
      );
    }

    return filtered.filter(todo => !todo.completed);
  };

  const getTodoColor = (todo: ClaimTodo, isActive: boolean = false) => {
    if (!selectedClaimId || !todo.claimIds.includes(selectedClaimId)) {
      return isActive ? 'border-gray-200 bg-white' : '';
    }

    const color = getClaimColor(selectedClaimId);
    return isActive 
      ? `${color.bg} ${color.border} border-2` 
      : `border-l-4 ${color.border}`;
  };

  const getTodoBadgeColor = (todo: ClaimTodo) => {
    if (!selectedClaimId || !todo.claimIds.includes(selectedClaimId)) {
      return 'bg-gray-100 text-gray-800';
    }

    const color = getClaimColor(selectedClaimId);
    return `${color.bg} ${color.text}`;
  };

  return {
    claimTodos: sortedTodos,
    getActiveClaimTodos,
    getTodoColor,
    getTodoBadgeColor
  };
};