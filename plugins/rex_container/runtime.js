﻿// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class
cr.plugins_.Rex_Container = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var pluginProto = cr.plugins_.Rex_Container.prototype;
		
	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};

	var typeProto = pluginProto.Type.prototype;

	typeProto.onCreate = function()
	{
        this.uid2container = {};  // pick container from instance's uid   
	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;
	};
	
	var instanceProto = pluginProto.Instance.prototype;

	instanceProto.onCreate = function()
	{
        this.insts_group = {};
		this.myDestroyCallback = (function (self) {
											return function(inst) {
												self.onInstanceDestroyed(inst);
											};
										})(this); 
        this.runtime.addDestroyCallback(this.myDestroyCallback);
	};
	
	instanceProto.onInstanceDestroyed = function (inst)
	{
        var uid=inst.uid;
        if (!(uid in this.type.uid2container))
            return;

        delete this.insts_group[inst.type.name][uid];                
        delete this.type.uid2container[uid];       
	};    
    
	instanceProto.onDestroy = function ()
	{
	    //debugger; 
        var uid2container = this.type.uid2container;
        var type_name,_container,uid,inst;
        var clear_flag = false;
        for (type_name in this.insts_group)
        {
            _container = this.insts_group[type_name];
            for(uid in _container)
            {
                inst = _container[uid];         
                this.runtime.DestroyInstance(inst);
                delete _container[uid];                
                delete uid2container[uid];
                clear_flag = true;
            }            
        }  
		this.runtime.removeDestroyCallback(this.myDestroyCallback);        
        if (clear_flag)
            this.runtime.ClearDeathRow();		
	};
	
	instanceProto.draw = function(ctx)
	{
	};
	
	instanceProto.drawGL = function(glw)
	{
	};
    
	instanceProto.add_insts = function(insts)
	{
        var type_name=insts[0].type.name;
        if (this.insts_group[type_name]==null)
            this.insts_group[type_name] = {};
        var _container = this.insts_group[type_name];
        var inst,i,cnt=insts.length;
        var uid2container = this.type.uid2container;
        for (i=0;i<cnt;i++)
        {
            inst = insts[i];
            uid2container[inst.uid] = this;
            _container[inst.uid] = inst;
        }
	};
    
	instanceProto.create_insts = function (obj_type,x,y,_layer)
	{
        if (obj_type == null)
            return;
        var layer = (typeof _layer == "number")?
                    this.runtime.getLayerByNumber(_layer):
                    this.runtime.getLayerByName(_layer);  
        var inst = this.runtime.createInstance(obj_type, layer, x, y ); 
        // Pick just this instance
        var sol = inst.type.getCurrentSol();
        sol.select_all = false;
		sol.instances.length = 1;
		sol.instances[0] = inst;   
	    this.add_insts([inst]);
	    return inst;
	};    
    
    instanceProto._pick_insts = function (objtype)
	{
        var type_name=objtype.name;
	    var _container = this.insts_group[type_name];	    
        var sol = objtype.getCurrentSol();  
        sol.select_all = true;   
        var insts = sol.getObjects();
        var insts_length = insts.length;
        var i, inst;
        sol.instances.length = 0;   // clear contents
        for (i=0; i < insts_length; i++)
        {
           inst = insts[i];
           if (inst.uid in _container)
               sol.instances.push(inst);
        }
        sol.select_all = false;    
        return  (sol.instances.length >0);       
	};
 	     
	instanceProto._pick_all_insts = function ()
	{
	    var type_name, _container, uid, inst, objtype, sol;
        for (type_name in this.insts_group)
        {
            _container = this.insts_group[type_name];
            objtype = null;
            for (uid in _container)
            {
                inst = _container[uid];
                if (objtype == null)
                {
                    objtype = inst.type;
                    sol = objtype.getCurrentSol();
                    sol.select_all = false;
                    sol.instances.length = 0;
                }
                sol.instances.push(inst);
            }
        }
	}; 	      
	//////////////////////////////////////
	// Conditions
	function Cnds() {};
	pluginProto.cnds = new Cnds();

	Cnds.prototype.PickInsts = function (objtype)
	{
		return this._pick_insts(objtype);
		return true;
	};  

	Cnds.prototype.PickContainer =function (objtype)
	{
    	var insts = objtype.getCurrentSol().getObjects();        
    	var cnt = insts.length;
    	if (cnt == 0)
            return false;  
        
        var i,container,container_uid,uids={}; 
	    var runtime = this.runtime;
	    var container_type = runtime.getCurrentCondition().type;         
        var sol = container_type.getCurrentSol();
        sol.select_all = false;
        sol.instances.length = 0;              
        for (i=0;i<cnt;i++)
        {
            container = container_type.uid2container[insts[i].uid]; 
            container_uid = container.uid;
            if ((container!=null) && !(container_uid in uids))
            {
                sol.instances.push(container);
                uids[container_uid] = true;                
            }
        }    	
        var current_event = runtime.getCurrentEventStack().current_event;
        runtime.pushCopySol(current_event.solModifiers);
        current_event.retrigger();
        runtime.popSol(current_event.solModifiers);
		return false;            
	}; 	

	Cnds.prototype.PickAllInsts = function ()
	{
	    this._pick_all_insts();
	    return true;
	};	
	//////////////////////////////////////
	// Actions
	function Acts() {};
	pluginProto.acts = new Acts();
		
	Acts.prototype.AddInsts = function (objs)
	{
        var insts = objs.getCurrentSol().getObjects();
        if (insts.length==0)
            return;
	    this.add_insts(insts);
	};
    
    Acts.prototype.PickInsts = function (objtype)
	{
	    this._pick_insts(objtype);
	}; 
	 
	Acts.prototype.PickAllInsts = function ()
	{
	    this._pick_all_insts();
	};	
	
	Acts.prototype.CreateInsts = function (obj_type,x,y,_layer)
	{
        this.create_insts(obj_type,x,y,_layer);
	};

    
	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	pluginProto.exps = new Exps();

}());