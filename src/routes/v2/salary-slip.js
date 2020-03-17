const express = require('express');
const router = express.Router();
const {
  users: User,
  employees: Employee,
  companies: Company,
  salary_details: SalaryDetails,
  salary_groups: SalaryGroups,
  presences: Presences,
  journals: Journals
} = require('@models');

var fonts = {
  Roboto: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic'
  }
};

// Initiate requirement to generate pdf
var PdfPrinter = require('pdfmake');
var printer = new PdfPrinter(fonts);
var fs = require('fs');

// @GET {...base url}/api/v2/salary/{id of Employee}/salary-slip?start=yyyy-mm-dd&end=yyyy-mm-dd
// @desc Generate salary report to pdf
// @access Private User
router.get('/:employeeId/salary-slip', async (req, res) => {
  try {
    const getEmployee = await Employee.findOne({ where: { id: req.params.employeeId } });
    if (!getEmployee) {
      return res.status(400).json({ errors: 'No Employee Found !' });
    }
    const getSalaryDetails = await SalaryDetails.findOne({ employee_id: req.params.employeeId });
    if (!getSalaryDetails) {
      return res.status(400).json({ errors: 'No Salary Info Found !' });
    }
    const getCompany = await Company.findById(getEmployee.company_id);
    const getUser = await User.findById(getEmployee.user_id);
    const getSalaryGroups = await SalaryGroups.findById(getSalaryDetails.salary_id);
    const getPresences = await Presences.findAll({
      where: {
        employee_id: req.params.employeeId,
        presence_date: {
          $between: [req.query.start, req.query.end]
        }
      }
    });
    const getJournals = await Journals.findAll({
      where: {
        employee_id: req.params.employeeId,
        created_at: {
          //Using UTC time, delete ('Z') if time will start from 00.00 Current Country Time
          //This setting time was start from '00.00 + N'
          $between: [req.query.start + 'T00:00:00.000Z', req.query.end + 'T23:59:59.999Z']
        }
      }
    });

    // sum array
    const getSum = (total, num) => {
      return total + num;
    };

    let isHolidays = [];
    let isLeaves = [];
    let isAbsence = [];
    await getPresences.forEach(item => {
      isHolidays.push(item.is_holiday);
      isLeaves.push(item.is_leave);
      isAbsence.push(item.is_absence);
    });

    let isDebet = [];
    let isCredit = [];
    await getJournals.forEach(item => {
      isDebet.push(item.debet);
      isCredit.push(item.kredit);
    });
    // all data Salary
    const salarySlip = {
      company: getCompany.company_name,
      name: getUser.full_name,
      period: `${req.query.start} - ${req.query.end}`,
      workdays: getEmployee.workdays,
      is_holidays: isHolidays.reduce(getSum),
      is_leave: isLeaves.reduce(getSum),
      is_absence: isAbsence.reduce(getSum),
      take_home_pay: 0, //total_allowance - total_reduction, will create soon bellow
      // pendapatan
      basic_salary: getSalaryGroups.salary,
      bonus: isDebet.reduce(getSum),
      meal_allowance: getSalaryGroups.lunch_allowance,
      transport_allowance: getSalaryGroups.transport_allowance,
      bpjs_allowance: getSalaryGroups.bpjs_allowance,
      jkk_allowance: getSalaryGroups.jkk_allowance,
      jkm_allowance: getSalaryGroups.jkm_allowance,
      jht_allowance: getSalaryGroups.jht_allowance,
      //deduksi
      wage_reduction: isCredit.reduce(getSum),
      jkk_reduction: getSalaryGroups.jkk_reduction,
      jkm_reduction: getSalaryGroups.jkm_reduction,
      jht_reduction: getSalaryGroups.jht_reduction,
      pph21_reduction: getSalaryGroups.tax_reduction
    };
    const total_reduction =
      salarySlip.wage_reduction +
      salarySlip.jkk_reduction +
      salarySlip.jkm_reduction +
      salarySlip.jht_reduction +
      salarySlip.pph21_reduction;

    const total_allowance =
      salarySlip.basic_salary +
      salarySlip.bonus +
      salarySlip.meal_allowance +
      salarySlip.transport_allowance +
      salarySlip.bpjs_allowance +
      salarySlip.jkk_allowance +
      salarySlip.jkm_allowance +
      salarySlip.jht_allowance;

    salarySlip.take_home_pay = total_allowance - total_reduction;
    // object to create pdf as table
    const docDefinition = {
      content: [
        {
          style: 'tableExample',
          table: {
            headerRows: 1,
            widths: ['*', '*', 'auto'],
            body: [
              [
                { text: salarySlip.company, style: 'tableHeader', bold: true },
                { text: 'Slip Gaji', bold: true, style: 'tableHeader' },
                ''
              ],
              [{ text: 'Nama', bold: true }, salarySlip.name, ''],
              [{ text: 'Periode', bold: true }, salarySlip.period, ''],
              [{ text: 'Hari Kerja', bold: true }, salarySlip.workdays, ''],
              [{ text: 'Libur', bold: true }, salarySlip.is_holidays, ''],
              [{ text: 'Cuti', bold: true }, salarySlip.is_leave, ''],
              [{ text: 'Tidak Hadir', bold: true }, salarySlip.is_absence, ''],
              [
                { text: 'Take Home Pay', bold: true },
                { text: 'IDR', bold: true },
                salarySlip.take_home_pay
              ],
              ['', '', ''],
              ['', '', ''],
              ['', '', ''],
              [{ text: 'Pendapatan :', bold: true }, '', ''],
              ['Gaji Pokok', salarySlip.basic_salary, ''],
              ['Bonus', salarySlip.bonus, ''],
              ['Tunjangan Makan', salarySlip.meal_allowance, ''],
              ['Tunjangan Transport', salarySlip.transport_allowance, ''],
              ['BPJS', salarySlip.bpjs_allowance, ''],
              ['JKK', salarySlip.jkk_allowance, ''],
              ['JKM', salarySlip.jkm_allowance, ''],
              ['JHT', salarySlip.jht_allowance, ''],
              [
                { text: 'Total Pendapatan', bold: true },
                { text: 'IDR', bold: true },
                total_allowance
              ],
              ['', '', ''],
              ['', '', ''],
              ['', '', ''],
              [{ text: 'Deduksi :', bold: true }, '', ''],
              ['Potongan', salarySlip.wage_reduction, ''],
              ['JKK', salarySlip.jkk_reduction, ''],
              ['JKM', salarySlip.jkm_reduction, ''],
              ['JHT', salarySlip.jht_reduction, ''],
              ['PPh21', salarySlip.pph21_reduction, ''],
              [{ text: 'Total Deduksi', bold: true }, { text: 'IDR', bold: true }, total_reduction]
            ]
          },
          layout: 'headerLineOnly'
        }
      ]
    };

    //process of creating pdf
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const salarySlipName = `${Date.now()}-salary-slip.pdf`;
    pdfDoc.pipe(fs.createWriteStream(`./public/uploads/documents/${salarySlipName}`));
    pdfDoc.end();

    //send response
    res.status(200).json({
      success: 'true',
      message: 'Slip gaji berhasil dibuat',
      data: {
        url: `${req.protocol}://${req.headers.host}/documents/${salarySlipName}`
      }
    });
  } catch (error) {
    return res.status(400).json(error);
  }
});

module.exports = router;
