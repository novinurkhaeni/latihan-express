const { gql } = require('apollo-server-express');
const Excel = require('exceljs');
const fs = require('fs');
const { employees: Employee, users: User } = require('@models');
const {
  errorHandler: { dbError },
  nodemailerMail,
  mailTemplates
} = require('@helpers');

const typeDef = gql`
  extend type Query {
    exportExcel(email: String!): String!
  }
`;

const resolvers = {
  Query: {
    exportExcel: async (root, { email }) => {
      try {
        let workbook = new Excel.Workbook();
        workbook.creator = 'Atenda';
        workbook.created = new Date();
        workbook.modified = new Date();

        let worksheet = workbook.addWorksheet('Data User');
        const users = await User.findAll({
          include: { model: Employee, where: { role: 1 }, required: true }
        });
        worksheet.addRow(['ID', 'Nama', 'Telepon']);
        const datas = [];
        for (const user of users) {
          datas.push([user.id, user.full_name, user.phone]);
        }
        worksheet.addRows(datas);
        const fileName = `User Data-${new Date().getTime()}.xlsx`;
        await workbook.xlsx.writeFile(fileName);
        /* eslint-disable indent */
        await nodemailerMail.sendMail({
          from: 'cs@atenda.id',
          to: email, // An array if you have multiple recipients.
          subject: `Export Excel: User`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.adminExportExcel({
            type: 'User'
          }),
          attachments: [
            {
              filename: fileName,
              path: fileName
            }
          ]
        });
        fs.unlinkSync(fileName);
        return 'Sukses';
      } catch (error) {
        dbError(error);
      }
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};
