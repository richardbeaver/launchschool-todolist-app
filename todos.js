const express = require("express");
const morgan = require("morgan");
const { body, validationResult } = require("express-validator");
const session = require("express-session");
const flash = require("express-flash");
const store = require("connect-loki");
const TodoList = require("./lib/todolist");
const Todo = require("./lib/todo");
const { sortTodoLists, sortTodos } = require("./lib/sort");

const HOST = "localhost";
const PORT = 3000;

const app = express();
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    cookie: {
      httpOnly: true,
      maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
      path: "/",
      secure: false,
    },
    name: "launch-school-todos-session-id",
    resave: false,
    saveUninitialized: true,
    secret: "this is not very secure",
    store: new LokiStore({}),
  })
);

app.use(flash());

// Set up persistent session data
app.use((req, _res, next) => {
  const todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach((todoList) => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  }

  req.session.todoLists = todoLists;
  next();
});

// Extract session info
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// ======================
// ======================

// Find a todo list with the indicated numeric ID. Returns `undefined` if
// not found
const loadTodoList = (todoListId, todoLists) =>
  todoLists.find((todoList) => todoList.id === todoListId);

// Find a todo with the indicated ID in the indiciated todo list. Returns
// `undefined` if not found. Both given ID's must be numeric
const loadTodo = (todoListId, todoId, todoLists) => {
  const todoList = loadTodoList(todoListId, todoLists);
  if (!todoList) return undefined;
  return todoList.todos.find((todo) => todo.id === todoId);
};

// Redirect start page
app.get("/", (_req, res) => {
  res.redirect("/lists");
});

// Render the list of todo lists
app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(req.session.todoLists),
  });
});

// Render the new todo list page
app.get("/lists/new", (_req, res) => {
  res.render("new-list");
});

// Create a new todo list
app.post(
  "/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .custom((title, { req }) => {
        const { todoLists } = req.session;
        const duplicate = todoLists.find((list) => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash("error", message.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("success", "The todo list has been created.");
      res.redirect("/lists");
    }
  }
);

// Render individual todo list and its todos
app.get("/lists/:todoListId", (req, res, next) => {
  const { todoListId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("list", {
      todoList,
      todos: sortTodos(todoList),
    });
  }
});

// Toggle an individual todo as done/not done
app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  const { todoListId, todoId } = req.params;
  const todo = loadTodo(+todoListId, +todoId, req.session.todoLists);
  if (!todo) {
    next(new Error("Not found."));
  } else {
    const { title } = todo;
    if (todo.isDone()) {
      todo.markUndone();
      req.flash("success", `${title} marked as NOT done.`);
    } else {
      todo.markDone();
      req.flash("success", `${title} marked done.`);
    }

    res.redirect(`/lists/${todoListId}`);
  }
});

// Delete a todo
app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  const { todoListId, todoId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    const todo = loadTodo(+todoListId, +todoId, req.session.todoLists);
    if (!todo) {
      next(new Error("Not found."));
    } else {
      todoList.removeAt(todoList.findIndexOf(todo));
      req.flash("success", "The todo has been deleted.");
      res.redirect(`/lists/${todoListId}`);
    }
  }
});

// Mark all todos as done
app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  const { todoListId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    todoList.markAllDone();
    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  }
});

// Create a new todo and add it to the specified list
app.post(
  "/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters."),
  ],
  (req, res, next) => {
    const { todoListId } = req.params;
    const todoList = loadTodoList(+todoListId, req.session.todoLists);
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach((err) => req.flash("error", err.msg));
        res.render("list", {
          flash: req.flash(),
          todoList,
          todos: sortTodos(todoList),
          todoTitle: req.body.todoTitle,
        });
      } else {
        const todo = new Todo(req.body.todoTitle);
        todoList.add(todo);
        req.flash("success", "The todo has been created.");
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

// Render edit todo list form
app.get("/lists/:todoListId/edit", (req, res, next) => {
  const { todoListId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    res.render("edit-list", { todoList });
  }
});

// Delete todo list
app.post("/lists/:todoListId/destroy", (req, res, next) => {
  const { todoLists } = req.session;
  const todoListId = +req.params.todoListId;
  const index = todoLists.findIndex((todoList) => todoList.id === todoListId);
  if (index === -1) {
    next(new Error("Not found."));
  } else {
    todoLists.splice(index, 1);
    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
});

// Edit todo list title
app.post(
  "/lists/:todoListId/edit",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .custom((title, { req }) => {
        const { todoLists } = req.session;
        const duplicate = todoLists.find((list) => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res, next) => {
    const { todoListId } = req.params;
    const todoList = loadTodoList(+todoListId, req.session.todoLists);
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach((err) => req.flash("error", err.msg));
        res.render("edit-list", {
          flash: req.flash(),
          todoListTitle: req.body.todoListTitle,
          todoList,
        });
      } else {
        todoList.setTitle(req.body.todoListTitle);
        req.flash("success", "Todo list updated.");
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

// Error handler
app.use((err, _req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

// Listener
app.listen(PORT, HOST, () => {
  console.log(`Listening on port ${PORT} of ${HOST}.`);
});
