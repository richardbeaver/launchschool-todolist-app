// Compare object titles alphabetically (case insensitive)
const compareByTitle = (itemA, itemB) => {
  const titleA = itemA.title.toLowerCase();
  const titleB = itemB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  }
  if (titleA > titleB) {
    return 1;
  }
  return 0;
};

module.exports = {
  // Return the list of todo lists sorted by completion status and title.
  sortTodoLists(todoLists) {
    const undone = todoLists.filter((todoList) => !todoList.isDone());
    const done = todoLists.filter((todoList) => todoList.isDone());
    undone.sort(compareByTitle);
    done.sort(compareByTitle);
    return [].concat(undone, done);
  },

  // Return the list of todos in the todo list sorted by completion status and
  // title.
  sortTodos(todoList) {
    const undone = todoList.todos.filter((todo) => !todo.isDone());
    const done = todoList.todos.filter((todo) => todo.isDone());
    undone.sort(compareByTitle);
    done.sort(compareByTitle);
    return [].concat(undone, done);
  },
};
