import chalk from "chalk";

class Logger {
  log(message = "", error = "") {
    if (message) {
      console.log(`${message}`, error);
    }
  }

  info(message) {
    this.log(chalk.blue(message));
  }

  success(message) {
    this.log(chalk.green(message));
  }

  warn(message) {
    this.log(chalk.yellow(message));
  }

  error(message, error) {
    this.log(chalk.red(message), error);
  }
}

export default new Logger();
