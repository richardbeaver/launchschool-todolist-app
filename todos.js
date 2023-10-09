const express = require("express");
const morgan = require("morgan");
const { body, validationResult } = require("express-validator");
const session = require("express-session");
const flash = require("express-flash");
const store = require("connect-loki");
const TodoList = require("./lib/todolist");
const { sortTodoLists, sortTodos } = require("./lib/sort");

const todoLists = require("./lib/seed-data");

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
app.use((req, res, next) => {
  //
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

// Redirect start page
app.get("/", (_req, res) => {
  res.redirect("/lists");
});

// Render the list of todo lists
app.get("/lists", (_req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(todoLists),
  });
});

// Render the new todo list page
app.get("/lists/new", (_req, res) => {
  res.render("new-list");
});

// Create a new todo list
app.post("/lists", (req, res) => {
  const title = req.body.todoListTitle.trim();
  todoLists.push(new TodoList(title));
  res.redirect("/lists");
});

// Error handler
/* eslint-disable-next-line no-unused-vars */
app.use((err, _req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

// Listener
app.listen(PORT, HOST, () => {
  console.log(`Listening on port ${PORT} of ${HOST}.`);
});
