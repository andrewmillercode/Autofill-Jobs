function getCurStageWorkday(form) {
  if (!form) return null;
  let progressBar = form.querySelector('[data-automation-id="progressBar"]');
  if (!progressBar) return null;
  let curStep = progressBar.querySelector(
    '[data-automation-id="progressBarActiveStep"]'
  );
  return curStep.children[2].textContent ?? null;
}

function workdayQuery(jobParam, form, type) {
  let normalizedParam = jobParam.toLowerCase();
  let inputElement = Array.from(form.querySelectorAll(type)).find((input) => {
    const attributes = [
      input.id?.toLowerCase().trim(),
      input.name?.toLowerCase().trim(),
      input.getAttribute("data-automation-id")?.toLowerCase().trim(),
      input.getAttribute("data-automation-label")?.toLowerCase().trim(),
    ];

    for (let i = 0; i < attributes.length; i++) {
      if (
        attributes[i] != undefined &&
        attributes[i].includes(normalizedParam) &&
        !attributes[i].includes("phonecode")
      ) {
        return true;
      }
    }
    return false;
  });
  return inputElement;
}
function workdayQueryAll(jobParam, form, type) {
  let normalizedParam = jobParam.toLowerCase();
  let res = [];

  Array.from(form.querySelectorAll(type)).forEach((input) => {
    const attributes = [
      input.id?.toLowerCase().trim(),
      input.name?.toLowerCase().trim(),
      input.getAttribute("data-automation-id")?.toLowerCase().trim(),
      input.getAttribute("data-automation-label")?.toLowerCase().trim(),
    ];
    for (let i = 0; i < attributes.length; i++) {
      if (
        attributes[i] &&
        attributes[i].includes(normalizedParam) &&
        !attributes[i].includes("phonecode")
      ) {
        res.push(input);
        break;
      }
    }
  });

  return res;
}
async function workDayAutofill(res) {
  await sleep(delays.initial);

  let wrkDayFields = Object.assign({}, fields.workday);
  let curInstanceCompleted = true;
  const observer = new MutationObserver(async () => {
    let curStage = getCurStageWorkday(document);
    if (curStage && wrkDayFields[curStage] && curInstanceCompleted) {
      curInstanceCompleted = false;
      await sleep(2000);
      for (let jobParam in wrkDayFields[curStage]) {
        //gets param from user data
        const param = wrkDayFields[curStage][jobParam];

        if (param === "Resume") {
          let resume = await handleResume(jobParam);
          if (resume) {
            delete wrkDayFields[curStage][jobParam];
            continue;
          }
        }
        if (param === "Skills") {
          let skills = await handleSkills();
          if (skills) {
            delete wrkDayFields[curStage][jobParam];
            continue;
          }
        }
        if (param === "Work Experience") {
          //initial click
          let workExp = await handleWorkExperience(jobParam);
          if (workExp) {
            delete wrkDayFields[curStage][jobParam];
            continue;
          }
        }

        let fillValue = res[param];
        if (!fillValue) {
          //no user data found for parameter
          delete wrkDayFields[curStage][jobParam];
          continue;
        }

        let inputElement = await handleInputElement(
          workdayQuery(jobParam, document, "input"),
          jobParam,
          param,
          fillValue
        );
        if (inputElement) {
          delete wrkDayFields[curStage][jobParam];
          continue;
        }

        let dropdown = await handleDropdownElement(
          workdayQuery(jobParam, document, "button"),
          fillValue
        );
        if (dropdown) {
          delete wrkDayFields[curStage][jobParam];
          continue;
        }

        //no element found
        delete wrkDayFields[curStage][jobParam];
      }
      // Click Continue button to proceed to the next stage
      let continueBtn = document.querySelector('button[data-automation-id="continueBtn"], button[data-automation-id="continueButton"]') ||
                        document.querySelector('button[data-automation-label="Continue"]') ||
                        Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim().toLowerCase().includes('continue'));
      if (continueBtn) {
        continueBtn.click();
      }
      curInstanceCompleted = true;
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}


async function handleResume(jobParam) {
  let inputElement = workdayQuery(jobParam, document, "input");
  const localData = await getStorageDataLocal();
  if (localData.Resume && inputElement) {
    const dt = new DataTransfer();
    let arrBfr = base64ToArrayBuffer(localData.Resume);

    dt.items.add(
      new File([arrBfr], `${localData["Resume_name"]}`, {
        type: "application/pdf",
      })
    );
    inputElement.files = dt.files;
    inputElement.dispatchEvent(changeEvent);
    console.log("AutofillJobs: Resume Uploaded.");
    await sleep(delays.long);
    return true;
  }
  return false;
}
async function handleSkills() {
  //initial click
  const data = await getStorageDataLocal("Resume_details");

  let val = data["Resume_details"];
  if (val) {
    if (typeof val === "string") {
      let jsonData = JSON.parse(val);
      val = jsonData;
    }
    let dropElement = document
      .querySelector('[data-automation-id="formField-skills"]')
      .querySelector('[data-automation-id="multiselectInputContainer"]');
    for (let skill of val.skills) {
      dropElement.click();
      await sleep(500);

      let inputElement = dropElement.children[1].children[0];
      if (
        inputElement.getAttribute("data-automation-id") != "monikerSearchBox"
      ) {
        inputElement = dropElement.children[0].children[0];
      }
      inputElement.focus();
      await sleep(200);

      inputElement.value = skill;
      inputElement.setAttribute("value", skill);
      inputElement.dispatchEvent(inputEvent); // Notify the UI about the change
      inputElement.dispatchEvent(changeEvent); // Trigger any change listeners
      await sleep(200);

      inputElement.dispatchEvent(keyDownEvent); // Simulate keydown (Enter)
      inputElement.dispatchEvent(keyUpEvent); // Simulate keyup (Enter)
      await sleep(1000);
      let el = document.querySelector(
        ".ReactVirtualized__Grid__innerScrollContainer"
      );
      if (el != undefined) {
        let backupOption = undefined;
        for (let o of el.children) {
          if (
            o
              .getAttribute("aria-label")
              .toLowerCase()
              .includes(skill.toLowerCase())
          ) {
            if (o.getAttribute("aria-label").toLowerCase().includes("|")) {
              backupOption = o.children[o];
              continue;
            }
            backupOption = undefined;
            o.children[0].click();
            break;
          }
        }
        if (backupOption != undefined) backupOption.click();
      }
    }

    await sleep(delays.short);
    return true;
  }
  return false;
}
async function handleWorkExperience(jobParam) {
  const data = await getStorageDataLocal("Resume_details");

  let val = data["Resume_details"];
  if (val) {
    if (typeof val === "string") {
      let jsonData = JSON.parse(val);
      val = jsonData;
    }
    let addExpBtn = workdayQuery(jobParam, document, "button");

    let i = 0;
    for (let exp of val.experiences) {
      addExpBtn.click();
      await sleep(1250);

      let jobTitle = workdayQueryAll("jobTitle", document, "input")[i];
      let jobCompany = workdayQueryAll("companyName", document, "input")[i];
      let isCurrentEmployer = workdayQueryAll(
        "currentlyWorkHere",
        document,
        "input"
      )[i];
      let description = workdayQueryAll(
        "roleDescription",
        document,
        "textarea"
      )[i];
      let startMonth = workdayQueryAll(
        "startDate-dateSectionMonth",
        document,
        "input"
      )[i];
      let startYear = workdayQueryAll(
        "startDate-dateSectionYear",
        document,
        "input"
      )[i];
      let endMonth = workdayQueryAll(
        "endDate-dateSectionMonth",
        document,
        "input"
      )[i];
      let endYear = workdayQueryAll(
        "endDate-dateSectionYear",
        document,
        "input"
      )[i];
      setNativeValue(jobTitle, exp.jobTitle);
      await sleep(500);
      setNativeValue(jobCompany, exp.jobEmployer);
      await sleep(500);
      setNativeValue(isCurrentEmployer, exp.isCurrentEmployer);
      await sleep(500);
      let sMonth = monthToNumber(
        exp.jobDuration.split("-")[0].trim().split(" ")[0]
      );
      let sYear = exp.jobDuration.split("-")[0].trim().split(" ")[1];
      let eMonth = monthToNumber(
        exp.jobDuration.split("-")[1].trim().split(" ")[0]
      );
      let eYear = exp.jobDuration.split("-")[1].trim().split(" ")[1];
      startMonth.click();
      setNativeValue(startMonth, sMonth);
      await sleep(600);
      startYear.click();
      setNativeValue(startYear, sYear);
      await sleep(600);
      endMonth.click();
      setNativeValue(endMonth, eMonth);
      await sleep(600);
      endYear.click();
      setNativeValue(endYear, eYear);
      await sleep(600);
      setNativeValue(description, exp.roleBulletsString);
      i++;
    }

    await sleep(delays.short);
    return true;
  }

  return false;
}
async function handleInputElement(inputElement, jobParam,param, fillValue) {
  if (inputElement != undefined) {
    //text fields
    if (jobParam == "month-input") {
      fillValue = res["Current Date"].split("/")[1];
    }
    if (jobParam == "day-input") {
      fillValue = res["Current Date"].split("/")[0];
    }
    if (jobParam == "year-input") {
      fillValue = res["Current Date"].split("/")[2];
    }
    if (param == "Discipline") {
      let dropElement = document.querySelector(
        "[data-automation-id='multiselectInputContainer']"
      );
      dropElement.click();
      await sleep(1000);
      let inputElement = document.querySelector(
        "input[id='education-4--fieldOfStudy']"
      );

      inputElement.value = fillValue;
      inputElement.setAttribute("value", fillValue);

      await sleep(500);
      inputElement.dispatchEvent(keyDownEvent);

      await sleep(2000);
      inputElement.dispatchEvent(keyUpEvent);
      let el = document.querySelector(
        ".ReactVirtualized__Grid__innerScrollContainer"
      );
      if (el != undefined) {
        let backupOption = undefined;
        for (let o of el.children) {
          if (
            o
              .getAttribute("aria-label")
              .toLowerCase()
              .includes(fillValue.toLowerCase())
          ) {
            if (o.getAttribute("aria-label").toLowerCase().includes("|")) {
              backupOption = o.children[o];
              continue;
            }
            backupOption = undefined;
            o.children[0].click();
            break;
          }
        }
        if (backupOption != undefined) backupOption.click();
      }
      return true;
    }

    setNativeValue(inputElement, fillValue);
  }
  return false;
}
async function handleDropdownElement(dropdownElement, fillValue) {
  if (dropdownElement != undefined) {
    dropdownElement.click();
    await sleep(delays.long);
    //for the dropdown elements(workday version)
    let dropDown = document.querySelector('ul[role="listbox"][tabindex="-1"]');
    if (dropDown) {
      let btns = dropDown.querySelectorAll("li div");
      let normalizedParam = fillValue.toLowerCase().trim();
      if (normalizedParam.includes("decline")) fillValue = "decline";
      btns.forEach((btndiv) => {
        if (
          btndiv.textContent.toLowerCase().includes(normalizedParam) ||
          normalizedParam.includes(btndiv.textContent.toLowerCase()) ||
          (btndiv.textContent.toLowerCase().includes("self") &&
            fillValue == "decline")
        ) {
          btndiv.click();
        }
      });
      await sleep(delays.short);
      dropdownElement.blur();
    }

    return true;
  }
  return false;
}
