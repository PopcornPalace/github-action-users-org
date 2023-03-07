import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
const { Octokit } = require("@octokit/rest");


interface User {
  organization: string;
  repository: string;
  name: string;
  login: string;
  permission: string;
}

interface UserMap {
  [key: string]: User;
}



async function run() {
  try {
    const token = core.getInput('token');
    const octokit = new Octokit({
      auth: token,
    });

    // Получаем список пользователей и их ролей в каждом репозитории организации
    const org = core.getInput('organization');
    const result = await octokit.repos.listForOrg({
      org: org,
      type: 'all',
    });

    // Создаем объекты для хранения пользователей и админов
    const users: UserMap = {};
    const admins = [];

    // Проходимся по каждому репозиторию и получаем информацию о пользователях
    for (const repo of result.data) {
      const permissions = await octokit.repos.listCollaborators({
        owner: org,
        repo: repo.name,
      });

      // Добавляем пользователей в общий список
      for (const user of permissions.data) {
        const login = user.login;
        const permission = user.permissions.admin ? 'admin' : 'user';
        const key = `${org}/${repo.name}/${login}`;

        users[key] = {
          organization: org,
          repository: repo.name,
          name: user.name,
          login: login,
          permission: permission,
        };

        // Добавляем админов в отдельный список
        if (permission === 'admin') {
          admins.push(users[key]);
        }
      }
    }

    // Сохраняем результаты в CSV файлы
    let usersCsv = 'organization,repository,name,login,permission\n';
    let adminsCsv = 'organization,repository,name,login,permission\n';

    for (const key in users) {
      const user = users[key];

      usersCsv += `${user.organization},${user.repository},${user.name},${user.login},${user.permission}\n`;

      if (user.permission === 'admin') {
        adminsCsv += `${user.organization},${user.repository},${user.name},${user.login},${user.permission}\n`;
      }
    }

    fs.writeFileSync('users.csv', usersCsv);
    fs.writeFileSync('admins.csv', adminsCsv);

    // Добавляем файл с админами в issue текущего репозитория
    const issueTitle = `Admins in ${org}`;
    const issueBody = 'Here is the list of admins in this organization';
    const file = 'admins.csv';

    const issue = await octokit.issues.create({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      title: issueTitle,
      body: issueBody,
    });

    await octokit.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.data.number,
      body: 'List of admins in CSV format:',
      headers: { accept: 'application/vnd.github.VERSION.raw' },
      name: file,
      data: fs.readFileSync(file),
    });
  } catch (error) {
    core.setFailed("Error: " + error);
  }
}

run();
