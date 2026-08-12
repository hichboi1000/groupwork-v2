import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import {
  getMyUnits,
  createUnit,
  getUnitOfferings,
  getUnitOfferingsHistory,
} from "../api/client";

import {
  BookOpenIcon,
  PlusCircleIcon,
  BuildingOfficeIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import EmptyState from "../components/ui/EmptyState";


export default function UnitsManagementPage() {


  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();


  const [units, setUnits] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [tab, setTab] = useState("units");


  useEffect(() => {
    if (searchParams.get("new")) {
      setTab("create");
      setSearchParams({}, { replace: true });
    }
  }, []);


  const [form, setForm] = useState({
    code:"",
    name:"",
  });


  const [pendingConfirm,setPendingConfirm] = useState(null);



  useEffect(()=>{

    loadAll();

  },[]);



  const loadAll = ()=>{

    setLoading(true);

    Promise.all([
      getMyUnits().catch(()=>({data:[]})),
      getUnitOfferings().catch(()=>({data:[]})),
      getUnitOfferingsHistory().catch(()=>({data:[]})),
    ])

    .then(([u,o,h])=>{

      setUnits(u.data);
      setOfferings(o.data);
      setHistory(h.data);

    })

    .finally(()=>setLoading(false));

  };




  const submitCreate = async(payload)=>{

    setError("");
    setSuccess("");


    try{

      const r = await createUnit(payload);


      if(r.data.created_new){

        setSuccess(
          `Unit ${r.data.unit.code} created successfully. Share the code with your class representatives.`
        );

      }


      else if(r.data.joined_existing){

        setSuccess(
          `You joined ${r.data.unit.code} as a co-lecturer.`
        );

      }


      setForm({
        code:"",
        name:"",
      });


      setPendingConfirm(null);


      loadAll();


    }

    catch(err){


      if(
        err.response?.status===409 &&
        err.response.data?.needs_confirmation
      ){

        setPendingConfirm({

          message:err.response.data.message,

          payload:{
            ...payload,
            confirm_join:true,
          }

        });

      }

      else{

        setError(
          err.response?.data?.error ||
          "Could not create or join unit."
        );

      }

    }

  };





  const handleSubmit=(e)=>{

    e.preventDefault();

    submitCreate({

      code:form.code.toUpperCase(),
      name:form.name,

    });

  };




  if(user?.role !== "lecturer"){
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <EmptyState icon="🚫" title="Lecturer Access Only" message="Unit management is only available for lecturers." />
      </div>
    );

  }




  if(loading){

    return (

      <div className="
        bg-surface
        rounded-[--radius-card]
        border
        p-10
        text-center
      ">

        Loading units...

      </div>

    );

  }





  const tabs=[

    {
      id:"units",
      label:`My Units (${units.length})`,
      icon:BookOpenIcon,
    },

    {
      id:"create",
      label:"Create / Join",
      icon:PlusCircleIcon,
    },

    {
      id:"classes",
      label:`Active Classes (${offerings.length})`,
      icon:BuildingOfficeIcon,
    },

    {
      id:"history",
      label:`History (${history.length})`,
      icon:ArchiveBoxIcon,
    },

  ];





  return (

    <div className="space-y-8">



      {/* HEADER */}

      <div>

        <h1 className="
          text-3xl
          font-bold
          text-ink
        ">
          Units Management
        </h1>


        <p className="
          text-muted
          mt-2
        ">
          Create academic units and manage lecturer access.
        </p>

      </div>




      {error && (

        <div className="
          bg-status-overdue-bg
          border
          border-status-overdue/30
          text-status-overdue
          rounded-[--radius-control]
          p-4
        ">
          {error}
        </div>

      )}




      {success && (

        <div className="
          bg-status-done-bg
          border
          border-status-done/30
          text-status-done
          rounded-[--radius-control]
          p-4
        ">
          {success}
        </div>

      )}




      {/* TABS */}

      <div className="
        bg-surface
        border
        rounded-[--radius-card]
        p-2
        flex
        flex-wrap
        gap-2
      ">


        {tabs.map(t=>{


          const Icon=t.icon;


          return (

            <button

              key={t.id}

              onClick={()=>setTab(t.id)}

              className={`
                flex
                items-center
                gap-2
                px-4
                py-2.5
                rounded-[--radius-control]
                transition

                ${
                  tab===t.id
                  ?
                  "bg-accent text-surface"
                  :
                  "hover:bg-status-todo-bg text-ink-soft"
                }

              `}

            >

              <Icon className="w-5 h-5"/>

              {t.label}

            </button>

          );

        })}


      </div>





      {/* UNITS */}


      {tab==="units" && (


        units.length===0 ?

        <EmptyState
          icon="📖"
          title="You don't teach any units yet"
          message="Post an assignment and you can create the unit in that same step — no need to set one up here first."
        />


        :


        <div className="
          grid
          md:grid-cols-2
          xl:grid-cols-3
          gap-6
        ">


          {units.map(unit=>(


            <div
              key={unit.id}
              className="
              bg-surface
              border
              rounded-[--radius-card]
              p-6
              shadow-sm
              hover:shadow-md
              transition
              "
            >

              <div className="
                flex
                justify-between
                items-start
              ">

                <div>

                  <h2 className="
                    font-bold
                    text-xl
                  ">
                    {unit.code}
                  </h2>


                  <p className="
                    text-muted
                    mt-1
                  ">
                    {unit.name}
                  </p>

                </div>


                <span className="
                  bg-accent-soft
                  text-accent-dark
                  px-3
                  py-1
                  rounded-lg
                  text-sm
                  font-semibold
                ">

                  {unit.code}

                </span>


              </div>




              {unit.lecturers?.length>1 && (

                <div className="mt-5">


                  <p className="
                    text-sm
                    text-muted
                    mb-2
                  ">
                    Co lecturers
                  </p>


                  <div className="flex flex-wrap gap-2">

                    {
                    unit.lecturers
                    .filter(l=>l.id!==user.id)
                    .map(l=>(

                      <span
                        key={l.id}
                        className="
                        bg-accent-soft
                        text-accent-dark
                        rounded-lg
                        px-3
                        py-1
                        text-sm
                        "
                      >

                        {l.full_name}

                      </span>

                    ))

                    }


                  </div>

                </div>

              )}



              <div className="
                mt-6
                text-sm
                text-ink-soft
              ">

                Share code

                <strong className="
                  text-accent-dark
                  ml-1
                ">
                  {unit.code}
                </strong>

                with class representatives.

              </div>



            </div>


          ))}


        </div>


      )}






      {/* CREATE */}



      {tab==="create" && (


        <div className="
          bg-surface
          border
          rounded-[--radius-card]
          p-8
          max-w-xl
          shadow-sm
        ">


          <h2 className="
            text-xl
            font-bold
          ">
            Create or Join Unit
          </h2>


          <p className="
            text-muted
            mt-2
            mb-6
          ">

            Enter the university unit code.

          </p>




          <form onSubmit={handleSubmit}
          className="space-y-5">


            <input

              className="
              w-full
              rounded-[--radius-control]
              border
              px-4
              py-3
              "

              placeholder="Unit Code e.g CS302"

              value={form.code}

              onChange={
                e=>setForm({
                  ...form,
                  code:e.target.value.toUpperCase()
                })
              }

              required

            />



            <input

              className="
              w-full
              rounded-[--radius-control]
              border
              px-4
              py-3
              "

              placeholder="Unit Name"

              value={form.name}

              onChange={
                e=>setForm({
                  ...form,
                  name:e.target.value
                })
              }

              required

            />



            <button

              className="
              w-full
              bg-accent
              hover:bg-accent-dark
              text-surface
              rounded-[--radius-control]
              py-3
              font-semibold
              "

            >

              Continue

            </button>



          </form>


        </div>


      )}






      {/* ACTIVE CLASSES */}

      {tab==="classes" && (

        <SimpleList

          items={offerings}

          empty="No active classes attached."

          render={(o)=>(

            <>
              <b>{o.class_detail?.name}</b>

              <p>
                {o.unit_detail?.code}
                {" · "}
                {o.class_detail?.group_count} groups
              </p>
            </>

          )}

        />

      )}






      {/* HISTORY */}

      {tab==="history" && (

        <SimpleList

          items={history}

          empty="No past offerings."

          render={(o)=>(

            <>
              <b>{o.class_detail?.name}</b>

              <p>
                {o.unit_detail?.code}
                {" — "}
                {o.unit_detail?.name}
              </p>
            </>

          )}

        />

      )}







      {/* CONFIRMATION */}

      {pendingConfirm && (

        <div className="
          fixed
          inset-0
          bg-black/40
          flex
          items-center
          justify-center
          z-50
        ">


          <div className="
            bg-surface
            rounded-[--radius-card]
            p-8
            max-w-md
          ">


            <h2 className="font-bold text-xl">
              Confirm Join
            </h2>


            <p className="text-ink-soft mt-3">
              {pendingConfirm.message}
            </p>


            <div className="
              flex
              gap-3
              mt-6
            ">

              <button
                className="
                px-4
                py-2
                rounded-[--radius-control]
                border
                "
                onClick={()=>setPendingConfirm(null)}
              >
                Cancel
              </button>


              <button
                className="
                px-4
                py-2
                rounded-[--radius-control]
                bg-accent
                text-surface
                "
                onClick={()=>submitCreate(pendingConfirm.payload)}
              >
                Join Anyway
              </button>


            </div>


          </div>


        </div>

      )}



    </div>

  );

}




function SimpleList({items,empty,render}){


if(items.length===0){

return (

<EmptyState
icon="📂"
message={empty}
/>

)

}



return (

<div className="
grid
md:grid-cols-2
gap-5
">

{items.map(i=>(

<div
key={i.id}
className="
bg-surface
border
rounded-[--radius-card]
p-6
shadow-sm
"
>

{render(i)}

</div>

))}

</div>

)

}