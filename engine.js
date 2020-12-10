'format cjs';

var wrap = require('word-wrap');
var map = require('lodash.map');
var longest = require('longest');
var chalk = require('chalk');

var filter = function (array) {
  return array.filter(function (x) {
    return x;
  });
};

var headerLength = function (answers) {
  return (
    answers.type.length + 2 + (answers.scope ? answers.scope.length + 2 : 0)
  );
};

var maxSummaryLength = function (options, answers) {
  return options.maxHeaderWidth - headerLength(answers);
};

var filterSubject = function (subject, disableSubjectLowerCase) {
  subject = subject.trim();
  if (
    !disableSubjectLowerCase &&
    subject.charAt(0).toLowerCase() !== subject.charAt(0)
  ) {
    subject =
      subject.charAt(0).toLowerCase() + subject.slice(1, subject.length);
  }
  while (subject.endsWith('.')) {
    subject = subject.slice(0, subject.length - 1);
  }
  return subject;
};

// This can be any kind of SystemJS compatible module.
// We use Commonjs here, but ES6 or AMD would do just
// fine.
module.exports = function (options) {
  var types = options.types;

  var length = longest(Object.keys(types)).length + 1;
  var choices = map(types, function (type, key) {
    return {
      name: (key + ':').padEnd(length) + ' ' + type.description,
      value: key,
    };
  });

  return {
    // When a user runs `git cz`, prompter will
    // be executed. We pass you cz, which currently
    // is just an instance of inquirer.js. Using
    // this you can ask questions and get answers.
    //
    // The commit callback should be executed when
    // you're ready to send back a commit template
    // to git.
    //
    // By default, we'll de-indent your commit
    // template and will keep empty lines.
    prompter: function (cz, commit) {
      // Let's ask some questions of the user
      // so that we can populate our commit
      // template.
      //
      // See inquirer.js docs for specifics.
      // You can also opt to use another input
      // collection library if you prefer.
      cz.prompt([
        {
          type: 'list',
          name: 'type',
          message: '选择你的提交类型',
          choices: choices,
          default: options.defaultType,
        },
        {
          type: 'input',
          name: 'scope',
          message: '更改的范围是什么？ (例如组件或文件名): (按回车跳过)',
          default: options.defaultScope,
          filter: function (value) {
            return options.disableScopeLowerCase
              ? value.trim()
              : value.trim().toLowerCase();
          },
        },
        {
          type: 'input',
          name: 'subject',
          message: function (answers) {
            return (
              '为这次提交增加个简短的主题 (max ' +
              maxSummaryLength(options, answers) +
              ' chars):\n'
            );
          },
          default: options.defaultSubject,
          validate: function (subject, answers) {
            var filteredSubject = filterSubject(
              subject,
              options.disableSubjectLowerCase
            );
            return filteredSubject.length == 0
              ? '必须填写主题'
              : filteredSubject.length <= maxSummaryLength(options, answers)
              ? true
              : '主题长度必须小于或等于 ' +
                maxSummaryLength(options, answers) +
                ' 个字符。 当前字符是 ' +
                filteredSubject.length +
                ' 个';
          },
          transformer: function (subject, answers) {
            var filteredSubject = filterSubject(
              subject,
              options.disableSubjectLowerCase
            );
            var color =
              filteredSubject.length <= maxSummaryLength(options, answers)
                ? chalk.green
                : chalk.red;
            return color('(' + filteredSubject.length + ') ' + subject);
          },
          filter: function (subject) {
            return filterSubject(subject, options.disableSubjectLowerCase);
          },
        },
        {
          type: 'input',
          name: 'body',
          message: '提供此次更改的详细说明或描述: (按回车跳过)\n',
          default: options.defaultBody,
        },
        {
          type: 'confirm',
          name: 'isBreaking',
          message: '是否有重大或者破坏性更新？',
          default: false,
        },
        {
          type: 'input',
          name: 'breakingBody',
          default: '-',
          message:
            '重大更新提交需要一个主题. 请输入具体一些的关于重大更新本身的主题描述:\n',
          when: function (answers) {
            return answers.isBreaking && !answers.body;
          },
          validate: function (breakingBody, answers) {
            return breakingBody.trim().length > 0 || '需要添加主题才能继续进行';
          },
        },
        {
          type: 'input',
          name: 'breaking',
          message: '为这个重大更新添加描述:\n',
          when: function (answers) {
            return answers.isBreaking;
          },
        },

        {
          type: 'confirm',
          name: 'isIssueAffected',
          message: '这次提交是否关联或者影响到已打开的issue?',
          default: options.defaultIssues ? true : false,
        },
        {
          type: 'input',
          name: 'issuesBody',
          default: '-',
          message:
            '如果了关闭issues, 请为这个提交添加一个有关关闭问题本身的具体的主题描述:\n',
          when: function (answers) {
            return (
              answers.isIssueAffected && !answers.body && !answers.breakingBody
            );
          },
        },
        {
          type: 'input',
          name: 'issues',
          message: '添加问题参考 (例如： "fix #123", "re #123".):\n',
          when: function (answers) {
            return answers.isIssueAffected;
          },
          default: options.defaultIssues ? options.defaultIssues : undefined,
        },
      ]).then(function (answers) {
        var wrapOptions = {
          trim: true,
          cut: false,
          newline: '\n',
          indent: '',
          width: options.maxLineWidth,
        };

        // parentheses are only needed when a scope is present
        var scope = answers.scope ? '(' + answers.scope + ')' : '';

        // Hard limit this line in the validate
        var head = answers.type + scope + ': ' + answers.subject;

        // Wrap these lines at options.maxLineWidth characters
        var body = answers.body ? wrap(answers.body, wrapOptions) : false;

        // Apply breaking change prefix, removing it if already present
        var breaking = answers.breaking ? answers.breaking.trim() : '';
        breaking = breaking
          ? 'BREAKING CHANGE: ' + breaking.replace(/^BREAKING CHANGE: /, '')
          : '';
        breaking = breaking ? wrap(breaking, wrapOptions) : false;

        var issues = answers.issues ? wrap(answers.issues, wrapOptions) : false;

        commit(filter([head, body, breaking, issues]).join('\n\n'));
      });
    },
  };
};
