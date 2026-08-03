import React, { useState, useEffect } from 'react';
import {
  List,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import TaskItem from './TaskItem';
import { DndContext, useSensors, useSensor, PointerSensor, KeyboardSensor, closestCenter, useDroppable } from '@dnd-kit/core';

const apiUrl = import.meta.env.VITE_API_URL;

export default function TaskTree({ project, taskID }) {
  const [tasks, setTasks] = useState([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingTaskAction, setPendingTaskAction] = useState(null);

  const fetchTasks = async () => {
    try {
      const endpoint = `${apiUrl}/api/tasks/project/${project.id}/${taskID ?? ''}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      const filterOldClosedTasks = (task) => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        if (task.completed && task.closed_at) {
          const closedAtDate = new Date(task.closed_at);
          if (closedAtDate < oneWeekAgo) {
            return null;
          }
        }

        if (task.subtasks && task.subtasks.length > 0) {
          task.subtasks = task.subtasks
            .map(filterOldClosedTasks)
            .filter(Boolean)
            .sort((a, b) => {
              const aEffective = a.completed || (a.is_recurring && a.current_counter >= a.objective);
              const bEffective = b.completed || (b.is_recurring && b.current_counter >= b.objective);
              if (aEffective !== bEffective) {
                return aEffective ? 1 : -1;
              }
              return a.position - b.position;
            });
        }

        return task;
      };

      let filteredData;
      if (Array.isArray(data)) {
        filteredData = data.map(filterOldClosedTasks).filter(Boolean).sort((a, b) => {
          const aEffective = a.completed || (a.is_recurring && a.current_counter >= a.objective);
          const bEffective = b.completed || (b.is_recurring && b.current_counter >= b.objective);
          if (aEffective !== bEffective) {
            return aEffective ? 1 : -1;
          }
          return a.position - b.position;
        });
      } else {
        filteredData = filterOldClosedTasks(data) ? [filterOldClosedTasks(data)] : [];
      }

      setTasks(filteredData);
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [project, taskID]);

  const toggleDone = async (taskId, done) => {
    try {
      if (done) {
        // Check if task has active subtasks
        const findTask = (taskList) => {
          for (const task of taskList) {
            if (task.id === taskId) {
              if (task.subtasks && task.subtasks.some(sub => !sub.completed)) {
                return true; // has active subtasks
              }
              return false;
            }
            if (task.subtasks) {
              const hasActive = findTask(task.subtasks);
              if (hasActive) return true;
            }
          }
          return false;
        };

        const hasActiveSubtasks = findTask(tasks);

        if (hasActiveSubtasks) {
          // Mostrar diálogo de confirmação em vez de window.confirm
          setPendingTaskAction({ type: 'close-recursive', taskId });
          setConfirmDialogOpen(true);
          return false; // Não continua imediatamente, aguarda confirmação
        }
      }

      // Normal update for non-closing or confirmed closing
      const response = await fetch(`${apiUrl}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: done }),
      });

      if (!response.ok) {
        console.error('Falha ao atualizar a task');
        return false;
      }

      await fetchTasks(); // Refetch to update state
      return true;
    } catch (err) {
      console.error('Erro ao fazer toggle da task:', err);
    }
  };

  const onEditTask = async (taskId, updates) => {
    try {
      const response = await fetch(`${apiUrl}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        console.error('Falha ao atualizar a task');
        return false;
      }

      await fetchTasks();

      return true;
    } catch (err) {
      console.error('Erro ao editar a task:', err);
    }
  };

  const addSubtask = async (parentId, data) => {
    try {
      const body = {
        project_id: project.id,
        parent_id: parentId,
        completed: false,
        position: 0,
        ...data
      };
      const response = await fetch(`${apiUrl}/api/tasks/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Erro ao criar tarefa');

      const { id: newTaskId } = await response.json();

      const endpoint = `${apiUrl}/api/tasks/project/${project.id}/${newTaskId}`;
      const res = await fetch(endpoint);
      const newTask = await res.json();

      const sortTasks = (tasks) =>
        tasks.sort((a, b) => {
          const aEffective = a.completed || (a.is_recurring && a.current_counter >= a.objective);
          const bEffective = b.completed || (b.is_recurring && b.current_counter >= b.objective);
          if (aEffective !== bEffective) {
            return aEffective ? 1 : -1;
          }
          return a.position - b.position;
        });

      const addSubtaskRec = (list) => {
        if (parentId === null) {
          return sortTasks([...list, newTask]);
        }
        return list.map((t) => {
          if (t.id === parentId) {
            return {
              ...t,
              subtasks: sortTasks([...(t.subtasks || []), newTask]),
            };
          }
          if (t.subtasks) {
            return {
              ...t,
              subtasks: addSubtaskRec(t.subtasks),
            };
          }
          return t;
        });
      };

      setTasks((prev) => addSubtaskRec(prev));
    } catch (err) {
      console.error('Erro ao adicionar tarefa:', err);
    }
  };

  // Função para apagar tarefa
  const deleteTask = async (taskId) => {
    try {
      const res = await fetch(`${apiUrl}/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao apagar tarefa');
      // Atualiza a lista recarregando do servidor:
      await fetchTasks();
    } catch (err) {
      console.error('Erro ao apagar tarefa:', err);
    }
  };

  // Envia atualização de posição (e parent_id quando fornecido, inclusive null)
  const updatePosition = async (taskId, newPosition, newParentId) => {
    try {
      const body = { position: newPosition };
      if (typeof newParentId !== 'undefined') {
        body.parent_id = newParentId; // permite null para mover para root
      }
      const response = await fetch(`${apiUrl}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Erro ao atualizar posição');
    } catch (err) {
      console.error('Erro ao atualizar posição:', err);
    }
  };

  const handleConfirmDialog = async () => {
    if (!pendingTaskAction) return;

    try {
      if (pendingTaskAction.type === 'close-recursive') {
        const response = await fetch(`${apiUrl}/api/tasks/${pendingTaskAction.taskId}/close-recursive`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          console.error('Falha ao fechar tarefa recursivamente');
          return;
        }

        await fetchTasks(); // Refetch to update state
      }
    } catch (err) {
      console.error('Erro ao executar ação pendente:', err);
    }

    setConfirmDialogOpen(false);
    setPendingTaskAction(null);
  };

  const handleCancelDialog = () => {
    setConfirmDialogOpen(false);
    setPendingTaskAction(null);
  };


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const RootDropZone = ({ id, sx }) => {
    const { isOver, setNodeRef } = useDroppable({ id });
    return (
      <Box
        ref={setNodeRef}
        sx={{
          height: 8,
          borderRadius: 1,
          bgcolor: isOver ? 'primary.main' : 'transparent',
          opacity: isOver ? 0.4 : 0,
          transition: 'all 120ms ease',
          my: 0.5,
          ...sx
        }}
      />
    );
  };

  // Helpers de árvore imutáveis
  const findSiblingsAndIndex = (list, id, parentId = null) => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (node.id === id) {
        return { siblings: list, index: i, parentId };
      }
      if (node.subtasks?.length) {
        const res = findSiblingsAndIndex(node.subtasks, id, node.id);
        if (res) return res;
      }
    }
    return null;
  };

  const getNodeById = (list, id) => {
    for (const n of list) {
      if (n.id === id) return n;
      if (n.subtasks?.length) {
        const found = getNodeById(n.subtasks, id);
        if (found) return found;
      }
    }
    return null;
  };

  const isDescendant = (list, ancestorId, maybeDescId) => {
    const ancestor = getNodeById(list, ancestorId);
    const walk = (node) => {
      if (!node?.subtasks?.length) return false;
      for (const child of node.subtasks) {
        if (child.id === maybeDescId) return true;
        if (walk(child)) return true;
      }
      return false;
    };
    return walk(ancestor);
  };

  const removeNodeImmutable = (list, id) => {
    const rec = (arr) => {
      const out = [];
      let removed = null;
      for (const node of arr) {
        if (node.id === id) {
          removed = { ...node };
          continue;
        }
        if (node.subtasks?.length) {
          const { newList, removed: r } = rec(node.subtasks);
          out.push({ ...node, subtasks: newList });
          if (r) removed = r;
        } else {
          out.push(node);
        }
      }
      return { newList: out, removed };
    };
    return rec(list);
  };

  const insertNodeImmutable = (list, parentId, index, node) => {
    const rec = (arr) => {
      if (parentId == null) {
        const newArr = [...arr];
        newArr.splice(index, 0, node);
        return newArr;
      }
      return arr.map((n) => {
        if (n.id === parentId) {
          const children = n.subtasks ? [...n.subtasks] : [];
          children.splice(index, 0, node);
          return { ...n, subtasks: children };
        }
        if (n.subtasks?.length) {
          return { ...n, subtasks: rec(n.subtasks) };
        }
        return n;
      });
    };
    return rec(list);
  };

  const getSiblingsArray = (tree, parentId) => {
    if (parentId == null) return tree;
    const parent = getNodeById(tree, parentId);
    return parent?.subtasks ?? [];
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event || {};
    if (!active || !over) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    // ids
    const activeId = Number(activeStr.replace('drag-', ''));
    if (Number.isNaN(activeId)) return;

    // Evitar no-op imediatamente óbvios
    if (overStr === `drop-before-${activeId}` || overStr === `drop-after-${activeId}` || overStr === `drop-inside-${activeId}`) {
      return;
    }

    // Determinar destino
    const parseOver = (tree) => {
      if (overStr === 'drop-root-before') {
        return { parentId: null, index: 0 };
      }
      if (overStr === 'drop-root-after') {
        return { parentId: null, index: tree.length };
      }
      if (overStr.startsWith('drop-inside-')) {
        const targetId = Number(overStr.replace('drop-inside-', ''));
        if (Number.isNaN(targetId)) return null;
        // Bloquear mover para dentro de descendente
        if (isDescendant(tasks, activeId, targetId) || targetId === activeId) return null;
        const targetNode = getNodeById(tasks, targetId);
        const childrenLen = targetNode?.subtasks?.length ?? 0;
        return { parentId: targetId, index: childrenLen };
      }
      if (overStr.startsWith('drop-before-') || overStr.startsWith('drop-after-')) {
        const targetId = Number(overStr.replace('drop-before-', '').replace('drop-after-', ''));
        if (Number.isNaN(targetId)) return null;
        if (targetId === activeId) return null;

        // Encontrar array de irmãos e índice do alvo (a partir da árvore atual)
        const targetInfo = findSiblingsAndIndex(tasks, targetId, null);
        if (!targetInfo) return null;

        const { siblings, index: targetIndex, parentId } = targetInfo;
        const before = overStr.startsWith('drop-before-');
        const baseIndex = before ? targetIndex : targetIndex + 1;
        return { parentId, index: baseIndex };
      }
      return null;
    };

    const fromInfo = findSiblingsAndIndex(tasks, activeId, null);
    if (!fromInfo) return;

    const dest = parseOver(tasks);
    if (!dest) return;

    let { parentId: fromParentId, index: fromIndex } = fromInfo;
    let { parentId: toParentId, index: toIndex } = dest;

    // Ajustar índice quando mover dentro do mesmo array de irmãos
    if (fromParentId === toParentId) {
      // Se forem o mesmo array e o item foi removido antes do destino, o índice destino decresce
      if (toIndex > fromIndex) {
        toIndex -= 1;
      }
      // Se destino for o mesmo índice após ajuste, não há mudança
      if (toIndex === fromIndex) return;
    }

    // Remover nó
    const { newList: withoutNode, removed } = removeNodeImmutable(tasks, activeId);
    if (!removed) return;
    const movedNode = { ...removed };

    // Inserir no destino
    const newTree = insertNodeImmutable(withoutNode, toParentId, toIndex, movedNode);

    // Atualizar UI imediatamente (optimistic)
    setTasks(newTree);

    // Persistir no backend:
    try {
      // 1) Atualizar o próprio item (posição e parent)
      await updatePosition(activeId, toIndex, toParentId ?? null);

      // 2) Reindexar posições dos irmãos no destino
      const destSibs = getSiblingsArray(newTree, toParentId);
      const destPromises = destSibs.map((n, idx) => updatePosition(n.id, idx));

      // 3) Reindexar posições dos irmãos na origem (se mudou de parent)
      let srcPromises = [];
      if (fromParentId !== toParentId) {
        const srcSibs = getSiblingsArray(newTree, fromParentId);
        srcPromises = srcSibs.map((n, idx) => updatePosition(n.id, idx));
      }

      await Promise.all([...destPromises, ...srcPromises]);
    } catch (err) {
      console.error('Erro ao persistir reordenação:', err);
      // Opcional: refetch para garantir consistência
      // await fetchTasks();
    }
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Box sx={{ mt: 2 }}>
          <List>
            {/* Root-level drop zone at top to allow dropping to root start */}
            <RootDropZone id="drop-root-before" sx={{ ml: 0 }} />

            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onAddSubtask={addSubtask}
                onEditTask={onEditTask}
                onDeleteTask={deleteTask}
                onToggleDone={toggleDone}
              />
            ))}

            {/* Root-level drop zone at bottom to allow dropping to root end */}
            <RootDropZone id="drop-root-after" sx={{ ml: 0 }} />
          </List>
        </Box>
      </DndContext>

      <Dialog
        open={confirmDialogOpen}
        onClose={handleCancelDialog}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          Confirmar Ação
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            Esta tarefa tem subtarefas ativas. Ao marcar como concluída, todas as subtarefas serão fechadas também. Deseja continuar?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDialog} color="primary">
            Cancelar
          </Button>
          <Button onClick={handleConfirmDialog} color="warning" variant="contained">
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
