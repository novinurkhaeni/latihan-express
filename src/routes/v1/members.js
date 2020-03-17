require('module-alias/register');
const { response } = require('@helpers');
const { memberService, journalService, scheduleService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { query, body, validationResult, param } = require('express-validator/check');

/*
 * GET /members/{employee_id}?month={month}&year={year}
 * Getting Member Detail
 */
router.get(
  '/:id/detail',
  [
    query('dateStart', 'start date required')
      .exists()
      .not()
      .isEmpty(),
    query('dateEnd', 'end date required')
      .exists()
      .not()
      .isEmpty(),
    param('id', 'id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.getDetail(req, res);
  }
);

// Will delete this enpoint soon when iOS get updated
router.get(
  '/:id',
  [
    query('month', 'month required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    query('year', 'year required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    param('id', 'id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.get(req, res);
  }
);

/*
 * PATCH /members/{employee_id}
 * Approving Member Request Join
 */
router.patch(
  '/:employee_id',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.salary')
      .exists()
      .not()
      .isEmpty()
      .withMessage('salary cannot be empty')
      .isNumeric()
      .withMessage('salary must be numeric'),
    body('*.workdays')
      .exists()
      .not()
      .isEmpty()
      .withMessage('workdays cannot be empty')
      .isNumeric()
      .withMessage('workdays must be numeric'),
    body('*.daily_salary')
      .exists()
      .not()
      .isEmpty()
      .withMessage('daily_salary cannot be empty')
      .isNumeric()
      .withMessage('daily_salary must be numeric'),
    body('*.flag')
      .exists()
      .not()
      .isEmpty()
      .withMessage('flag cannot be empty')
      .isNumeric()
      .withMessage('flag must be numeric')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.patch(req, res);
  }
);

/*
 * PUT /members/{employee_id}
 * Edit Member Data and Information
 */
router.put(
  '/:employee_id',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.full_name')
      .optional({ nullable: true })
      .isString()
      .withMessage('full_name must be string'),
    body('*.phone')
      .optional({ nullable: true })
      .isMobilePhone('id-ID')
      .withMessage('phone must be in phone number format'),
    body('*.email')
      .optional({ nullable: true })
      .isEmail()
      .withMessage('email must be in email format'),
    body('*.role')
      .optional({ nullable: true })
      .isInt()
      .withMessage('role must be integer')
      .custom(value => {
        if (value === 1 || value === 2 || value === 3 || value === 4) {
          return true;
        } else {
          throw new Error('role must be either 1, 2, 3 or 4');
        }
      }),
    body('*.salary')
      .optional({ nullable: true })
      .isNumeric()
      .withMessage('salary must be numeric'),
    body('*.workdays')
      .optional({ nullable: true })
      .not()
      .isEmpty()
      .withMessage('workdays required')
      .isNumeric()
      .withMessage('workdays must be numeric'),
    body('*.daily_salary')
      .optional({ nullable: true })
      .not()
      .isEmpty()
      .withMessage('daily_salary required')
      .isNumeric()
      .withMessage('daily_salary must be numeric')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.put(req, res);
  }
);

/*
 * DELETE /members/{employee_id}
 * Delete Member Data and Information related to it
 */
router.delete(
  '/:employee_id',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.delete(req, res);
  }
);

/*
 * DELETE /members/{employee_id}/invitation
 * Delete member's invitation to join a company
 */

router.delete(
  '/:employee_id/invitation',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.deleteInvitation(req, res);
  }
);

/*
 * POST /members/{employee_id}/journals
 * Create or update journal of employee
 */
router.post(
  '/:employee_id/journals',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.type', 'type cannot be empty')
      .exists()
      .not()
      .isEmpty()
      .isString(),
    body('*.debet', 'debet atleast value of zero')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.kredit', 'kredit atleast value of zero')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.description', 'description cannot be empty')
      .exists()
      .not()
      .isEmpty()
      .isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    journalService.post(req, res);
  }
);

/*
 * POST /members/{employee_id}/notes
 * Create or update notes of employee
 */
router.post(
  '/:employee_id/notes',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.date', 'should be date format yyyy-mm-dd')
      .exists()
      .not()
      .isEmpty(),
    body('*.notes', 'notes cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.notes(req, res);
  }
);

/*
 * POST /members/{employee_id}/absence/{presence_id}
 * Update presence status to absence
 */
router.post(
  '/:employee_id/absence/:presence_id',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.type', 'type cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.absence(req, res);
  }
);

/*
 * POST /members/{employee_id}/schedules/once
 * Create schedule of employee with only a date
 */
router.post(
  '/:employee_id/schedules/once',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.presence_date', 'presence_date cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.presence_start', 'presence_start is cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.presence_end', 'presence_end is cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.once(req, res);
  }
);

/*
 * POST /members/{employee_id}/schedules/continous
 * Create schedule pattern of employee
 */
router.post(
  '/:employee_id/schedules/continous',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.start_date', 'start_date cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.end_date', 'end_date is cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.start_time', 'start_time is cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.end_time', 'end_time is cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.continous(req, res);
  }
);

module.exports = router;
